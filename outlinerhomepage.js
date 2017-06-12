const shell = require (__dirname + "/lib/electronshell.js");
const fs = require ("fs");   

var currentFilePath = undefined;
var whenLastKeystroke = new Date (), whenLastUserAction = new Date ();
var editorSerialnum = 0;
var idCurrentEditor = undefined;
var whenLastSave = undefined;
var flPrefsChanged = false;
var twUserInfo;
var flScheduledEveryMinute = false;

var appPrefs = { 
	flOneNotePerDay: true, typeInsertedNode: "outline", flPlusIconMonthBased: true, flSimplifiedInsertPossible: true, //for opNewPost
	flConfirmTweets: true, maxTweetLength: 140, flCheckForReplies: false, flBeepIfNoReplies: false, lastSeenMyTweetId: undefined, ctMinBetwTweetReplyCheck: 5,
	lastLinkUrl: "",
	lastInstantOutlineUrl: "",
	fnameScriptsOutline: "menubar.opml",
	fnameIconBarOutline: "iconbar.opml",
	fnameBookmarksOutline: "bookmarks.opml", //6/11/17 by DW
	flUploadJson: true,
	flFirstLaunch: true //5/18/17 by DW
	};

//public outlines
	function outlineToJson (adrx, nameOutlineElement) {
		var theOutline = new Object ();
		if (nameOutlineElement === undefined) {
			nameOutlineElement = "source\\:outline";
			}
		xmlGatherAttributes (adrx, theOutline);
		if (xmlHasSubs (adrx)) {
			theOutline.subs = [];
			$(adrx).children (nameOutlineElement).each (function () {
				theOutline.subs [theOutline.subs.length] = outlineToJson (this, nameOutlineElement);
				});
			}
		return (theOutline);
		}
	function callInstantOutlinerGlue (urlOutline, title, description, callback) {
		var apiUrl = "http://instantoutliner.com/createglue?", flfirst = true;
		function pushparam (name, val) {
			if (!flfirst) {
				apiUrl += "&";
				}
			apiUrl += name + "=" + encodeURIComponent (val);
			flfirst = false;
			}
		pushparam ("url", urlOutline);
		pushparam ("title", title);
		pushparam ("description", description);
		pushparam ("socketserver", shell.getConfig ().urlChatLogSocket);
		readHttpFile (apiUrl, function (urlInstant) {
			if (callback !== undefined) {
				callback (urlInstant);
				}
			});
		}
	function uploadPublicOpml (callback) { //5/3/17 by DW
		if (twIsTwitterConnected ()) {
			var headers = opGetHeaders ();
			function getOutlineJson () {
				var xstruct = $($.parseXML (getCurrentOpml ()));
				var adrbody = getXstuctBody (xstruct);
				var jstruct = {
					head: headers,
					body: outlineToJson (adrbody, "outline")
					};
				var jsontext = jsonStringify (jstruct);
				return (jsontext);
				}
			if (getBoolean (headers.flPublic)) {
				var tab = shell.getCurrentTab (), remotePath = shell.getConfig ().outlinesPath + stringLastField (tab.f, "/");
				twUploadFile (remotePath, getCurrentOpml (), "text/xml", false, function (data) {
					var urlOpmlFile = data.url; //5/18/17 by DW
					console.log ("uploadPublicOpml: data == " + jsonStringify (data));
					var headers = opGetHeaders ();
					if (headers.urlPublic === undefined) {
						headers.urlPublic = urlOpmlFile;
						opSetHeaders (headers);
						}
					if (appPrefs.flUploadJson) {
						var jsontext = getOutlineJson (), jsonPath = stringPopExtension (remotePath) + ".json";
						console.log ("uploadPublicOpml: jsontext.length == " + jsontext.length);
						twUploadFile (jsonPath, jsontext, "application/json", false, function (data) {
							console.log ("uploadPublicOpml: json url == " + data.url);
							if (headers.urlJson === undefined) {
								headers.urlJson = data.url;
								opSetHeaders (headers);
								}
							if (callback !== undefined) {
								callback (urlOpmlFile);
								}
							});
						}
					else {
						if (callback !== undefined) {
							callback (urlOpmlFile);
							}
						}
					});
				}
			}
		}
	function makeOutlinePublic () {
		confirmDialog ("Make the current outline public?", function () {
			var headers = opGetHeaders ();
			headers.flPublic = true;
			opSetHeaders (headers);
			uploadPublicOpml (function (urlPublicOpml) {
				var title = headers.title, description = headers.description;
				if (headers.longTitle !== undefined) {
					title = headers.longTitle;
					}
				if (description === undefined) {
					description = "";
					}
				callInstantOutlinerGlue (urlPublicOpml, title, description, function (urlInstant) {
					var headers = opGetHeaders ();
					headers.urInstant = urlInstant
					headers.urlUpdateSocket = shell.getConfig ().urlChatLogSocket;
					opSetHeaders (headers);
					askDialog ("The public URL for this tab is:", urlInstant, "", function (url, flcancel) {
						});
					});
				});
			});
		}
	function viewOutlineOpml () {
		var headers = opGetHeaders ();
		if (headers.urlPublic === undefined) {
			alertDialog ("Can't view the OPML because the file isn't public.")
			}
		else {
			shell.openUrl (headers.urlPublic);
			}
		}
	function subscribeToInstantOutlineCommand () {
		askDialog ("Enter the link for the outline:", appPrefs.lastInstantOutlineUrl, "Enter some kind of URL to an instant outline", function (url, flcancel) {
			if (!flcancel) {
				appPrefs.lastInstantOutlineUrl = url; //something like http://instantoutliner.com/1
				prefsChanged ();
				readHttpFile (url + "?format=data", function (jsontext) {
					var jstruct = JSON.parse (jsontext);
					console.log ("subscribeToInstantOutlineCommand: jsontext == " + jsontext);
					var tab = shell.addInstantTab (url, jstruct);
					readHttpFile (tab.urlOpmlFile, function (opmltext) {
						tab.temp.idThisEditor = startEditor (opmltext);
						showEditor (true);
						});
					
					
					});
				}
			});
		}
//title-description dialog
	function closeTitleDescriptionDialog () {
		$("#idTitleDescriptionDialog").modal ("hide"); 
		}
	function okTitleDescriptionDialog () {
		var title = $("#idShortTitle").val ();
		opSetTitle (title);
		var theHeaders = opGetHeaders ();
		theHeaders.longTitle = $("#idLongTitle").val ();
		theHeaders.description = $("#idDescription").val ();
		opSetHeaders (theHeaders);
		closeTitleDescriptionDialog ();
		var tab = appPrefs.myTabs [appPrefs.ixCurrentTab];
		tab.name = title;
		buildTabs ();
		}
	function titleDescriptionDialog () {
		var theHeaders = opGetHeaders ();
		function setDialogValue (id, val) {
			if (val === undefined) {
				val = "";
				}
			$("#" + id).val (val);
			}
		setDialogValue ("idShortTitle", opGetTitle ());
		setDialogValue ("idLongTitle", theHeaders.longTitle);
		setDialogValue ("idDescription", theHeaders.description);
		$("#idTitleDescriptionDialog").modal ("show"); 
		}
//scripts menu
	function getScriptsMenuFile () {
		var f = getUserDataFolder () + appPrefs.fnameScriptsOutline; 
		return (f);
		}
	function deleteScriptsMenus () {
		$("#idMainMenuList").children ("li").each (function () {
			var id = $(this).attr ("id");
			if (beginsWith (id, "idScriptMenu")) {
				$(this).remove ();
				}
			});
		}
	function startScriptsMenu (opmltext) {
		function getOpmltext (callback) {
			if (opmltext !== undefined) {
				callback (opmltext);
				}
			else {
				var f = getScriptsMenuFile (); 
				fs.readFile (f, function (err, data) {
					if (err) {
						console.log ("startScriptsMenu: err.message == " + err.message);
						}
					else {
						callback (data.toString ());
						}
					});
				}
			}
		getOpmltext (function (opmltext) {
			xmlBuildMenusFromOpmltext (opmltext, "idDocsMenu", function (theScript) {
				console.log ("Callback from xmlBuildMenusFromOpmltext, theScript == " + theScript);
				try {
					shell.runScript (theScript, function (val, errMsg) {
						if (errMsg !== undefined) {
							alertDialog (errMsg);
							}
						});
					}
				catch (e) {
					alertDialog ("Error running script: " + e.message + ".");
					}
				});
			});
		}
	
//bookmarks menu
	const idBookmarkMenuPrefix = "idBookmarkMenu";
	const nameBookmarkIcon = "bookmark";
	
	function getBookmarksMenuFile () {
		var f = getUserDataFolder () + appPrefs.fnameBookmarksOutline; 
		return (f);
		}
	function addBookmark () {
		var tab = shell.getCurrentTab (), f = tab.f, title = tab.title;
		openBookmarksOpml ();
		confirmDialog ("Add this file to the Bookmarks menu?", function () {
			opGo (up, infinity)
			opInsert (title, up);
			opSetOneAtt ("f", f);
			opSetOneAtt ("icon", nameBookmarkIcon);
			});
		}
	function buildBookmarksMenu (opmltext) { 
		function openFileViaBookmark (f) {
			console.log ("You want to open the file == " + f);
			openOutlineInTab (f);
			}
		function getOpmltext (callback) {
			if (opmltext !== undefined) {
				callback (opmltext);
				}
			else {
				var f = getBookmarksMenuFile (); 
				fs.readFile (f, function (err, data) {
					if (err) {
						console.log ("buildBookmarksMenu: err.message == " + err.message);
						}
					else {
						callback (data.toString ());
						}
					});
				}
			}
		getOpmltext (function (opmltext) {
			var maxCharsMenuItem = 25, liDivider = "<li class=\"divider\"></li>";
			$("#idBookmarksList").empty ();
			$("#idBookmarksList").append ("<li><a onclick=\"addBookmark ();\">Add bookmark...</a></li>");
			$("#idBookmarksList").append (liDivider);
			var xstruct = $($.parseXML (opmltext));
			var adrbody = getXstuctBody (xstruct);
			
			function getMenu (adrMenuInOutline, whereToAttach, flSubMenu) {
				console.log ("getMenu: flSubMenu == " + flSubMenu + ", whereToAttach == " + whereToAttach);
				xmlOneLevelVisit (adrMenuInOutline, function (adrsub) {
					if (!xmlIsComment (adrsub)) {
						var textatt = trimWhitespace (xmlGetAttribute (adrsub, "text"));
						if (textatt == "-") {
							whereToAttach.append (liDivider);
							}
						else {
							if (xmlHasSubs (adrsub)) {
								var liMenuItem = $("<li class=\"dropdown-submenu\"><a href=\"#\">" + textatt + "</a></li>");
								var ulSubMenu = $("<ul class=\"dropdown-menu\"></ul>");
								whereToAttach.append (liMenuItem);
								getMenu (adrsub, ulSubMenu, true);
								liMenuItem.append (ulSubMenu);
								}
							else {
								var liMenuItem = $("<li></li>");
								var fileatt = xmlGetAttribute (adrsub, "f");
								var menuItemNameLink = $("<a></a>");
								//set text of menu item
									var itemtext = maxLengthString (textatt, maxCharsMenuItem);
									if (itemtext.length === 0) {
										itemtext = "&nbsp;";
										}
									menuItemNameLink.html (itemtext);
								menuItemNameLink.click (function (event) { 
									event.preventDefault ();
									if (fileatt !== undefined) {
										openFileViaBookmark (fileatt);
										}
									});
								liMenuItem.append (menuItemNameLink);
								whereToAttach.append (liMenuItem);
								}
							}
						}
					return (true);
					});
				}
			
			getMenu (adrbody, $("#idBookmarksList"), false);
			
			$("#idBookmarksMenu").css ("display", "block");
			});
		}
//icon bar
	var ctIconBarIcons = 0;
	
	function getIconBarFile () {
		var f = getUserDataFolder () + appPrefs.fnameIconBarOutline; 
		return (f);
		}
	function setupIconHandlers () {
		$(".iIcon").mouseenter (function () {
			$(this).css ("color", "dimgray");
			});
		$(".iIcon").mouseleave (function () {
			$(this).css ("color", "silver");
			});
		$(".iIcon").mousedown (function () {
			$(this).css ("color", "black");
			});
		$(".iIcon").mouseup (function () {
			$(this).css ("color", "dimgray");
			});
		}
	function xmlBuildIconBarFromOpmltext (opmltext, idIconToInsertAfter, evalCallback) {
		var xstruct = $($.parseXML (opmltext)), ctScriptMenus = 0;
		var adrbody = getXstuctBody (xstruct);
		xmlOneLevelVisit (adrbody, function (adricon) {
			
			function getTitleAtt () {
				var att = xmlGetAttribute (adricon, "title");
				if (att === undefined) {
					att = "";
					}
				return (att);
				}
			
			if (!xmlIsComment (adricon)) {
				var iconName = xmlGetTextAtt (adricon);
				console.log ("xmlBuildIconBarFromOpmltext: iconName == " + iconName);
				var idThisIcon = "idIcon" + ++ctIconBarIcons;
				var divIcon = $("<div></div>");
				divIcon.addClass ("divIcon");
				divIcon.attr ("id", idThisIcon);
				
				
				var subtext = trimWhitespace (xmlGetSubText (adricon));
				if (subtext.length > 0) {
					divIcon.data ("script", subtext);
					
					var whenCreated = xmlGetAttribute (adricon, "created"); //1/22/17 by DW
					if (whenCreated !== undefined) {
						divIcon.data ("created", whenCreated);
						}
					
					divIcon.click (function (event) { 
						var s = $(this).data ("script");
						event.preventDefault ();
						if (evalCallback !== undefined) {
							evalCallback (s, this); 
							}
						else {
							eval (s);
							}
						});
					}
				
				
				
				
				var iconLink = $("<a></a>");
				iconLink.attr ("href", "#");
				iconLink.attr ("data-toggle", "tooltip");
				iconLink.attr ("title", getTitleAtt ());
				iconLink.html ("<i class=\"fa fa-" + stringLower (iconName) + " iIcon\"></i>");
				
				divIcon.append (iconLink);
				divIcon.insertAfter ("#" + idIconToInsertAfter);
				idIconToInsertAfter = idThisIcon;
				}
			return (true); //keep visiting
			});
		}
	function deleteUserIcons () {
		var fldone = false;
		$($("#idIconList").children ().get ().reverse ()).each (function () {
			var id = $(this).attr ("id");
			if (id == "idIconToInsertAfter") {
				fldone = true;
				}
			if (!fldone) {
				$(this).remove ();
				}
			});
		}
	function startIconBar (opmltext) {
		function getOpmltext (callback) {
			if (opmltext !== undefined) {
				callback (opmltext);
				}
			else {
				var f = getIconBarFile (); 
				fs.readFile (f, function (err, data) {
					if (err) {
						console.log ("startIconBar: err.message == " + err.message);
						}
					else {
						callback (data.toString ());
						}
					});
				}
			}
		getOpmltext (function (opmltext) {
			console.log (opmltext);
			xmlBuildIconBarFromOpmltext (opmltext, "idIconToInsertAfter", function (theScript) {
				console.log ("Callback from xmlBuildIconBarFromOpmltext, theScript == " + theScript);
				try {
					shell.runScript (theScript, function (val, errMsg) {
						if (errMsg !== undefined) {
							alertDialog (errMsg);
							}
						});
					}
				catch (e) {
					alertDialog ("Error running script: " + e.message + ".");
					}
				});
			});
		}
	
	
	
	
	
//render mode
	function getRenderMode () {
		return ($(opGetActiveOutliner ()).concord ().op.getRenderMode ());
		}
	function toggleRenderMode () {
		$(opGetActiveOutliner ()).concord ().op.setRenderMode (!getRenderMode ());
		}
	function updateRenderModeCommandString () {
		var s = (getRenderMode ()) ? "Visible markup" : "Invisible markup"; //6/26/16 by DW
		$("#idRenderModeCommandString").html (s);
		}





function getUserDataFolder () {
	return (shell.getConfig ().userDataFolder);
	}
function openSpecialFile (fname) {
	var f = getUserDataFolder () + fname;
	console.log ("openSpecialFile: f == " + f);
	fs.exists (f, function (flExists) {
		if (flExists) {
			openOutlineInTab (f);
			}
		else {
			newOutlineFile (f);
			}
		});
	}
function openMenubarOpml () {
	openSpecialFile ("menubar.opml");
	}
function openIconbarOpml () {
	openSpecialFile ("iconbar.opml");
	}
function openBookmarksOpml () {
	openSpecialFile ("bookmarks.opml");
	}
function setDefaultOutliner () {
	idDefaultOutliner = shell.getCurrentTab ().temp.idThisEditor;
	}
function editOpmlHeaders () { 
	tabEdShow ("Edit headers", opGetHeaders (), function (editedTable) {
		console.log ("editOpmlHeaders: editedTable == " + jsonStringify (editedTable));
		if (editedTable.title !== undefined) {
			opSetTitle (editedTable.title);
			}
		opSetHeaders (editedTable);
		});
	}
function getInitialOpmlText (title) {
	var s = 
		"<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n<opml version=\"2.0\">\n\t<head>\n\t\t<title>[%title%]</title>\n\t\t<dateCreated>[%created%]</dateCreated>\n\t\t<dateModified>[%created%]</dateModified>\n\t\t</head>\n\t<body>\n\t\t<outline text=\"\" created=\"[%created%]\" />\n\t\t</body>\n\t</opml>";
	var replacetable = {
		title: title,
		created: new Date ().toUTCString ()
		};
	s = multipleReplaceAll (s, replacetable, false, "[%", "%]");
	return (s);
	}
function toggleTwitterConnect () {
	shell.toggleTwitterConnect ()
	}
function fileFromPath (f) {
	return (stringLastField (f, "/"));
	}
function setOpmlHeadersBeforeSaving () {
	if (twIsTwitterConnected ()) {
		var headers = opGetHeaders (), screenName = twGetScreenName ();
		headers.ownerId = "https://twitter.com/" + screenName + "/";
		headers.ownerName = twUserInfo.name;
		headers.ownerTwitterScreenName = screenName;
		opSetHeaders ();
		}
	}
function prefsChanged () {
	flPrefsChanged = true;
	}
function tweetThisIconClick () {
	var theText = opGetLineText (), type = opGetOneAtt ("type"), url = opGetOneAtt ("url"), ctTweetChars = theText.length;
	function doTweet () {
		twOutlinerTweet (theText, undefined, opGetCursorContext ());
		}
	if (type == "tweet") {
		twViewCursorTweet ();
		}
	else {
		if (url !== undefined) { //it had a url attribute
			theText += " " + url;
			ctTweetChars += twGetUrlLength () + 1;
			}
		if (ctTweetChars > appPrefs.maxTweetLength) {
			alertDialog ("Can't send the tweet because it is too long. It's " + ctTweetChars + " characters, the max is " + appPrefs.maxTweetLength + ".");
			}
		else {
			if (appPrefs.flConfirmTweets) {
				confirmDialog ("Tweet the text?", function () {
					doTweet ();
					});
				}
			else {
				doTweet ();
				}
			}
		}
	}
function checkForTwitterReplies () { //5/25/17 by DW
	ifOutlineHasTweet (function () {
		console.log ("everyMinute: Looking for replies to tweets in this outline.");
		twOutlinerGetTwitterReplies ();
		});
	}
function linkIconClick () {
	var defaultUrl = appPrefs.lastLinkUrl, urlAtt = opGetOneAtt ("url");
	if ((!opInTextMode ()) && (urlAtt != undefined)) {
		defaultUrl = urlAtt;
		}
	askDialog ("Enter URL for link:", defaultUrl, "http://", function (url, flcancel) {
		if (!flcancel) {
			if (opInTextMode ()) {
				opLink (url);
				}
			else {
				opSetOneAtt ("type", "link");
				opSetOneAtt ("url", url);
				opMarkChanged ();
				}
			appPrefs.lastLinkUrl = url;
			prefsChanged ();
			}
		});
	}
function editAttributes () {
	function checkEnclosure (editedTable) { //6/9/17 by DW
		if (editedTable.enclosure !== undefined) {
			if (editedTable.enclosureType === undefined) {
				var obj = { //set up struct required by getRssEnclosureInfo
					enclosure: {
						url: editedTable.enclosure
						}
					};
				getRssEnclosureInfo (obj, function () { //call a fargoPub server to fill in the length and type of the enclosure
					editedTable.enclosureType = obj.enclosure.type;
					editedTable.enclosureLength = obj.enclosure.length;
					opSetAtts (editedTable);
					});
				}
			}
		}
	tabEdShow ("Edit attributes", opGetAtts (), function (editedTable) {
		opSetAtts (editedTable);
		console.log ("editAttributes: atts == " + jsonStringify (editedTable));
		checkEnclosure (editedTable);
		});
	}
function updateAttsDisplay () {
	try { //errors were showing up here -- 5/15/17 by DW -- but the problem certainly wasn't here
		var when = opGetOneAtt ("created"), whenstring = "";
		function formatDateTime (d) {
			d = new Date (d);
			return (d.toLocaleDateString () + " at " + d.toLocaleTimeString ());
			}
		if (when !== undefined) {
			whenstring = "<span class=\"spCreatedAttDisplay\">Created: " + formatDateTime (when) + ". </span>";
			}
		var attsstring = opGetAttsDisplayString ()
		if (attsstring.length > 0) {
			attsstring = " Atts: " + attsstring;
			}
		
		var charsstring = " length=" + opGetLineText ().length + ".";
		
		$("#idAttributesDisplay").html (whenstring + attsstring + charsstring);
		
		$("#idFilepath").text (getCurrentFilePath ());
		}
	catch (err) {
		console.log ("updateAttsDisplay: err.message == " + err.message);
		}
	}
function showEditor (flDisplay) {
	var val;
	if (flDisplay) {
		val = "block";
		}
	else {
		val = "none";
		}
	$("#idEditorContainer").css ("display", val);
	}
function runCursorScript () {
	var theScript = opGetLineText ();
	shell.runScript (theScript, function (val, errorMessage) {
		console.log ("runCursorScript: val == " + val + ", errorMessage == " + errorMessage);
		if (errorMessage !== undefined) {
			alertDialog (errorMessage);
			}
		else {
			opDeleteSubs ();
			opInsert (val, "right");
			opMakeComment ();
			opGo ("left", 1);
			}
		});
	}
function addOutlinerCallbacks (idOutlineObject) {
	if (idOutlineObject === undefined) {
		idOutlineObject = "#outliner";
		}
	else {
		idOutlineObject = "#" + idOutlineObject;
		}
	function myExpandCallback () {
		try {
			var type = opGetOneAtt ("type"), url = opGetOneAtt ("url");
			console.log ("myExpandCallback: type == " + type);
			if ((type == "link") && (url != undefined)) {
				shell.openUrl (url);
				return;
				}
			if ((type == "include") && (url != undefined)) { //2/16/15 by DW
				var headers = {"Accept": "text/x-opml"}; //7/17/15 by DW -- the same header the OPML Editor uses for includes.
				console.log ("myExpandCallback: headers = " + jsonStringify (headers));
				twReadHttpWithProxy (url, function (s) {
					opDeleteSubs ();
					opInsertXml (s, right); 
					opClearChanged ();
					}, undefined, headers);
				return;
				}
			if (type == "tweet") { //7/17/16 by DW
				if (opCountSubs () == 0) {
					shell.openUrl (twGetCursorTweetUrl ()); 
					return;
					}
				}
			}
		catch (err) {
			console.log ("opExpandCallback: error == " + err.message);    
			}
		}
	$(idOutlineObject).concord ({
		"callbacks": {
			"opInsert": function (op) {
				opInsertCallback (op);
				},
			"opCursorMoved": function (op) {
				whenLastUserAction = new Date (); 
				
				if (opGetOneAtt ("created") === undefined) { //no <i>created</i> att, add one -- 1/22/17 by DW
					opSetOneAtt ("created", new Date ().toUTCString ());
					}
				
				updateAttsDisplay ();
				opMarkChanged (); //1/30/15 by DW
				},
			"opKeystroke": function (event) {
				if (event.metaKey) {
					if (event.which == 75) { //cmd-k is a shortcut for the link icon
						linkIconClick ();
						}
					}
				if (event.which == 8) { //5/1/15 by DW
					opMarkChanged ();
					}
				if ((event.which >= 33) && (event.which <= 36)) { //4/30/15 by DW -- pageup, pagedown, home, end
					//Concord was inserting these, wiping out the headline, this is where Doc's empty headlines were coming from.
						//so we just translate them to 31, which Concord will ignore.
						//the best solution is to fix Concord so it ignores these.
						//but I really don't want to rebuild it right now. too much other stuff depends on it. 
					event.which = 31;
					}
				if ((event.which == 191) && event.metaKey && event.shiftKey) { //cmd-? -- 3/27/13 by DW
					showCribsheet ();
					}
				opKeystrokeCallback (event);
				},
			"opExpand": function () {
				myExpandCallback (); 
				},
			"opCollapse": function () {
				opCollapseCallback (); 
				}
			}
		});
	$(idOutlineObject).keyup (function () {
		whenLastKeystroke = new Date ();
		whenLastUserAction = whenLastKeystroke;
		});
	$(idOutlineObject).keydown (function (ev) {
		if ((ev.which == 191) && event.metaKey) {
			console.log ("Cmd-/");
			runCursorScript ();
			event.stopPropagation ();
			}
		});
	}
function setOutlinerText (idOutlineObject, opmltext, flReadOnly) {
	idDefaultOutliner = idOutlineObject; //set global
	opInitOutliner (opmltext, flReadOnly);
	addOutlinerCallbacks (idOutlineObject);
	}
function getCurrentOpml () {
	idDefaultOutliner = shell.getCurrentTab ().temp.idThisEditor;
	return (opOutlineToXml ("", ""));
	}
function getCurrentFilePath () {
	var f = shell.getCurrentTab ().f;
	return (f);
	}
function startEditor (opmltext) {
	var idThisEditor = "idEditor" + editorSerialnum++;
	if (idCurrentEditor !== undefined) {
		$("#" + idCurrentEditor).css ("display", "none");
		}
	$("#idEditorContainer").append ("<div class=\"divEditor\" id=\"" + idThisEditor + "\"></div>");
	idCurrentEditor = idThisEditor;
	setOutlinerText (idThisEditor, opmltext, false);
	$("#" + idThisEditor).on ("keyup", function (event) {
		whenLastKeystroke = new Date ();
		whenLastUserAction = whenLastKeystroke;
		console.log ("keyup");
		});
	return (idThisEditor);
	}
function viewActiveTab (tab, callback) {
	if (tab.temp.idThisEditor === undefined) {
		if (tab.flInstantOutline) {
			console.log ("viewActiveTab: tab.flInstantOutline == " + tab.flInstantOutline);
			readHttpFile (tab.urlOpmlFile, function (opmltext) {
				tab.temp.idThisEditor = startEditor (opmltext);
				showEditor (true);
				});
			}
		else {
			var f = tab.f;
			fs.readFile (f, function (err, data) {
				tab.temp.idThisEditor = startEditor (data.toString ());
				showEditor (true);
				if (callback !== undefined) {
					callback ();
					}
				});
			}
		}
	else {
		if (idCurrentEditor !== undefined) {
			$("#" + idCurrentEditor).css ("display", "none");
			}
		$("#" + tab.temp.idThisEditor).css ("display", "block");
		idCurrentEditor = tab.temp.idThisEditor;
		if (callback !== undefined) {
			callback ();
			}
		}
	}

function clickTabIfOpen (f) { //6/11/17 by DW
	var myTabs = shell.getTabsArray ();
	for (i = 0; i < myTabs.length; i++) {
		if (myTabs [i].f == f) {
			shell.tabClick (i);
			return (true);
			}
		}
	return (false);
	}

function openOutlineInTab (f, callback) {
	if (!clickTabIfOpen (f)) {
		var tab = shell.addTab (stringLastField (f, "/"), f);
		currentFilePath = f;
		viewActiveTab (tab, callback);
		}
	}
function ifOutlineHasTweet (callback) { //call the callback if the current outline has at least one tweet node -- 8/3/16 by DW
	opVisitAll (function (headline) {
		var type = headline.attributes.getOne ("type");
		if (type == "tweet") {
			callback ();
			return (false); //found it
			}
		else {
			return (true); //keep looking
			}
		});
	}
function newOutlineFile (f) {
	var opmltext = getInitialOpmlText (fileFromPath (f));
	fs.writeFile (f, opmltext, function (err) {
		openOutlineInTab (f);
		checkSpecialFileSave (f, opmltext); //6/12/17 by DW
		}); 
	}
function newFileCommand () {
	shell.newFileDialog (function (f) {
		newOutlineFile (f);
		});
	}
function openFileCommand () {
	shell.openFileDialog (function (filelist) {
		openOutlineInTab (filelist [0]);
		});
	}
function closeTabCommand () {
	shell.closeTab ();
	}
function openSettingsDialog () {
	shell.openSettingsDialog (function (appPrefsFromStorage) {
		for (var x in appPrefsFromStorage) {
			appPrefs [x] = appPrefsFromStorage [x];
			}
		});
	}
function updateSaveStatus () {
	var s = "SAVED";
	if (opHasChanged ()) {
		s = "<div style=\"color: silver\">NOT " + s + "</div>";
		}
	else {
		s = "<div style=\"color: black\">" + s + "</div>";
		}
	$("#idSaveStatus").html (s);
	$("#idSaveStatus").css ("display", "block");
	}
function checkSpecialFileSave (f, opmltext) { //6/12/17 by DW
	if (f == getScriptsMenuFile ()) { 
		deleteScriptsMenus ();
		startScriptsMenu (opmltext);
		}
	if (f == getIconBarFile ()) { //5/31/17 by DW
		deleteUserIcons ();
		startIconBar (opmltext);
		}
	if (f == getBookmarksMenuFile ()) { //6/11/17 by DW
		buildBookmarksMenu (opmltext);
		}
	}
function everyMinute () {
	var now = new Date (), config = shell.getConfig ();
	console.log ("\neveryMinute: " + now.toLocaleTimeString () + ", " + config.productname + " v" + config.version + ".");
	if (appPrefs.flCheckForReplies) {
		if ((now.getMinutes () % appPrefs.ctMinBetwTweetReplyCheck) == 0) {
			checkForTwitterReplies ();
			}
		}
	}
function everySecond () {
	var now = clockNow ();
	setDefaultOutliner ();
	if (secondsSince (whenLastUserAction) >= 0.5) {
		if (opHasChanged ()) {
			var opmltext,  f = getCurrentFilePath ();
			setOpmlHeadersBeforeSaving ()
			opmltext = getCurrentOpml ();
			console.log ("everySecond: saving opml. " + opmltext.length + " chars, " + secondsSince (whenLastKeystroke) + " secs since keystroke.");
			fs.writeFile (f, opmltext, function (err) {
				whenLastSave = now;
				opClearChanged ();
				uploadPublicOpml (); //5/3/17 by DW
				checkSpecialFileSave (f, opmltext); //6/12/17 by DW
				});
			}
		}
	if (flPrefsChanged) {
		flPrefsChanged = false;
		shell.setPrefs (appPrefs);
		}
	updateAttsDisplay ();
	initTwitterMenuItems ();
	updateSaveStatus ();
	updateRenderModeCommandString (); 
	setupIconHandlers (); //6/2/17 by DW
	if (!flScheduledEveryMinute) { 
		if (now.getSeconds () == 0) {
			setInterval (everyMinute, 60000); 
			flScheduledEveryMinute = true;
			everyMinute (); //it's the top of the minute, we have to do one now
			}
		}
	}
function startup () {
	var options = {
		tabClickCallback: function (tab) {
			console.log ("tabClickCallback: tab == " + jsonStringify (tab));
			currentFilePath = tab.f;
			viewActiveTab (tab);
			try {
				updateAttsDisplay (); //it'll fail on startup, other times we want the quick response
				}
			catch (err) {
				}
			},
		tabCloseCallback: function (tab) {
			console.log ("tabCloseCallback: tab == " + jsonStringify (tab));
			},
		tabUpdatedCallback: function (tab, theData) {
			console.log ("tabUpdatedCallback: theData.length == " + theData.length);
			setOutlinerText (tab.temp.idThisEditor, theData, true);
			},
		applySettingsCallback: function (theSettings) {
			}
		};
	shell.init (options, function (appPrefsFromStorage) {
		for (var x in appPrefsFromStorage) {
			appPrefs [x] = appPrefsFromStorage [x];
			}
		if (appPrefs.flFirstLaunch) { //5/18/17 by DW -- give them a file to start with first time the app launches
			console.log ("startup: appPrefs.flFirstLaunch == " + appPrefs.flFirstLaunch);
			newOutlineFile (getUserDataFolder () + "hello.opml");
			appPrefs.flFirstLaunch = false;
			}
		prefsChanged ();
		showEditor (true);
		startScriptsMenu ();
		startIconBar (); //5/30/17 by DW
		buildBookmarksMenu (); //6/11/17 by DW
		initTwitterMenuItems ();
		if (twIsTwitterConnected ()) {
			twGetUserInfo (twGetScreenName (), function (userinfo) {
				twUserInfo = userinfo;
				console.log ("startup: twUserInfo == " + jsonStringify (twUserInfo));
				twGetTwitterConfig (function () { 
					everySecond (); //don't wait for the next second, call immediately
					self.setInterval (everySecond, 1000); 
					});
				});
			}
		else {
			everySecond (); //don't wait for the next second, call immediately
			self.setInterval (everySecond, 1000); 
			}
		});
	}
