const shell = require (__dirname + "/lib/electronshell.js");
const fs = require ("fs");   

var currentFilePath = undefined;
var whenLastKeystroke = new Date ();
var editorSerialnum = 0;
var idCurrentEditor = undefined;
var whenLastSave = undefined;
var flPrefsChanged = false;
var twUserInfo;

var appPrefs = { 
	flOneNotePerDay: true, typeInsertedNode: "outline", flPlusIconMonthBased: true, //for opNewPost
	lastLinkUrl: "",
	lastInstantOutlineUrl: ""
	};

//public outlines
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
		var headers = opGetHeaders ();
		if (getBoolean (headers.flPublic)) {
			var tab = shell.getCurrentTab (), remotePath = shell.getConfig ().outlinesPath + stringLastField (tab.f, "/");
			twUploadFile (remotePath, getCurrentOpml (), "text/xml", false, function (data) {
				console.log ("uploadPublicOpml: data == " + jsonStringify (data));
				var headers = opGetHeaders ();
				if (headers.urlPublic === undefined) {
					headers.urlPublic = data.url;
					opSetHeaders (headers);
					}
				if (callback !== undefined) {
					callback (data.url);
					}
				});
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
	tabEdShow ("Edit attributes", opGetAtts (), function (editedTable) {
		opSetAtts (editedTable);
		console.log ("editAttributes: atts == " + jsonStringify (editedTable));
		});
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
function addOutlinerCallbacks () {
	function myExpandCallback () { //6/29/16 by DW
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
					twViewCursorTweet ();
					return;
					}
				}
			}
		catch (err) {
			console.log ("opExpandCallback: error == " + err.message);    
			}
		}
	$("#outliner").concord ({
		"callbacks": {
			"opInsert": function (op) {
				opInsertCallback (op);
				},
			"opCursorMoved": function (op) {
				console.log ("cursor moved");
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
	$("#outliner").keyup (function () {
		whenLastUserAction = new Date ();
		});
	}
function setOutlinerText (idOutlineObject, opmltext, flReadOnly) {
	idDefaultOutliner = idOutlineObject; //set global
	opInitOutliner (opmltext, flReadOnly);
	addOutlinerCallbacks ();
	}
function getCurrentOpml () {
	return (opOutlineToXml ("", ""));
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
function openOutlineInTab (f, callback) {
	var tab = shell.addTab (stringLastField (f, "/"), f);
	currentFilePath = f;
	viewActiveTab (tab, callback);
	}
function newFileCommand () {
	shell.newFileDialog (function (f) {
		fs.writeFile (f, getInitialOpmlText (fileFromPath (f)), function (err) {
			openOutlineInTab (f, function () {
				});
			}); 
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
function everySecond () {
	var now = clockNow ();
	if (secondsSince (whenLastKeystroke) >= 0.5) {
		if (opHasChanged ()) {
			var opmltext;
			setOpmlHeadersBeforeSaving ()
			opmltext = getCurrentOpml ();
			console.log ("everySecond: saving opml. " + opmltext.length + " chars, " + secondsSince (whenLastKeystroke) + " secs since keystroke.");
			fs.writeFile (currentFilePath, opmltext, function (err) {
				whenLastSave = now;
				opClearChanged ();
				uploadPublicOpml (); //5/3/17 by DW
				});
			}
		}
	if (flPrefsChanged) {
		flPrefsChanged = false;
		shell.setPrefs (appPrefs);
		}
	}
function startup () {
	var options = {
		tabClickCallback: function (tab) {
			console.log ("tabClickCallback: tab == " + jsonStringify (tab));
			currentFilePath = tab.f;
			viewActiveTab (tab);
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
		prefsChanged ();
		showEditor (true);
		if (twIsTwitterConnected ()) {
			twGetUserInfo (twGetScreenName (), function (userinfo) {
				twUserInfo = userinfo;
				console.log ("startup: twUserInfo == " + jsonStringify (twUserInfo));
				twGetTwitterConfig (function () { 
					self.setInterval (everySecond, 1000); 
					});
				});
			}
		else {
			self.setInterval (everySecond, 1000); 
			}
		});
	}
