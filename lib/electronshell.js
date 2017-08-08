exports.init = init;
exports.getConfig = shellGetConfig; //5/3/17 by DW
exports.openUrl = shellOpenUrl;
exports.openFolder = shellOpenFolder;
exports.openUserDataFolder = shellOpenUserDataFolder;
exports.toggleTwitterConnect = shellToggleTwitterConnect;
exports.openFileDialog = shellOpenFileDialog;
exports.newFileDialog = shellNewFileDialog;
exports.openSettingsDialog = shellOpenSettingsDialog;
exports.closeSettingsDialog = settingsCloseDialog;
exports.okSettingsDialog = settingsOkClicked;
exports.getPrefs = shellGetPrefs;
exports.setPrefs = shellSetPrefs;
exports.addTab = addTab;
exports.addInstantTab = addInstantTab;
exports.tabClick = tabClick;
exports.closeTab = closeTab;
exports.getCurrentTab = getCurrentTab;
exports.getTabsArray = getTabsArray;
exports.lockIconClick = lockIconClick;
exports.runScript = shellRunScript;

const fs = require ("fs");  
const electron = require ("electron");

var config = undefined;
var prefs = {
	appPrefs: new Object (),
	myTabs: new Array (),
	ixCurrentTab: 0,
	ctPrefsSaves: 0,
	whenLastPrefsSave: undefined
	};
var fnamePrefs = "prefs.json";
var flPrefsChanged = false;

var appOptions = undefined; //callbacks provided by the app

function setStatusMessage (s) {
	var visibility = "visible";
	if (s.length == 0) {
		visibility = "hidden";
		}
	$("#idStatusMessageContainer").css ("visibility", visibility);
	$("#idStatusMessage").html (s);
	}
function shellGetConfig () { //4/21/17 by DW
	var theConfig = JSON.parse (require ("electron").ipcRenderer.sendSync ("synchronous-message", "getConfig")); 
	return (theConfig);
	}
function shellSetConfig (theConfigSubset) { //4/21/17 by DW
	require ("electron").ipcRenderer.send ("asynch-message", "setConfig", jsonStringify (theConfigSubset));  
	}
function shellSetupSystemMenus () { 
	electron.remote.app.setName (config.productnameForDisplay); 
	var template = [
		{ //Edit menu
			label: 'Edit',
			submenu: [
				{
					label: 'Undo',
					accelerator: 'CmdOrCtrl+Z',
					role: 'undo'
					},
				{
					label: 'Redo',
					accelerator: 'Shift+CmdOrCtrl+Z',
					role: 'redo'
					},
				{
					type: 'separator'
					},
				{
					label: 'Cut',
					accelerator: 'CmdOrCtrl+X',
					role: 'cut'
					},
				{
					label: 'Copy',
					accelerator: 'CmdOrCtrl+C',
					role: 'copy'
					},
				{
					label: 'Paste',
					accelerator: 'CmdOrCtrl+V',
					role: 'paste'
					},
				{
					label: 'Select All',
					accelerator: 'CmdOrCtrl+A',
					role: 'selectall'
					},
				]
			},
		{ //Window menu
			label: 'Window',
			role: 'window',
			submenu: [
				{
					label: 'Minimize',
					accelerator: 'CmdOrCtrl+M',
					role: 'minimize'
					},
				{
					label: 'Close',
					accelerator: 'CmdOrCtrl+W',
					role: 'close'
					},
				{
					type: 'separator'
					},
				{
					label: 'Reload',
					accelerator: 'CmdOrCtrl+R',
					click: function(item, focusedWindow) {
						if (focusedWindow)
							focusedWindow.reload();
						}
					},
				{
					label: 'JavaScript console...',
					accelerator: (function() {
						if (process.platform == 'darwin')
							return 'Alt+Command+I';
						else
							return 'Ctrl+Shift+I';
						})(),
					click: function(item, focusedWindow) {
						if (focusedWindow)
							focusedWindow.toggleDevTools();
						}
					}
				]
			},
		];
	if (process.platform == 'darwin') {
		const dialog = electron.remote.dialog;
		var aboutDialogOptions = {
			type: "info",
			title: "About Dialog",
			buttons: ["OK"],
			message: config.productnameForDisplay + " v" + config.version,
			detail: config.description
			};
		template.unshift ({
			label: config.productnameForDisplay,
			submenu: [
				{
					label: 'About ' + config.productnameForDisplay + "...",
					click: function () {
						dialog.showMessageBox (aboutDialogOptions);
						}
					},
				{
					type: 'separator'
					},
				{
					label: 'Services',
					role: 'services',
					submenu: []
					},
				{
					type: 'separator'
					},
				{
					label: 'Hide ' + name,
					accelerator: 'Command+H',
					role: 'hide'
					},
				{
					label: 'Hide Others',
					accelerator: 'Command+Alt+H',
					role: 'hideothers'
					},
				{
					label: 'Show All',
					role: 'unhide'
					},
				{
					type: 'separator'
					},
				{
					label: 'Quit',
					accelerator: 'Command+Q',
					click: function () {electron.remote.app.quit ();}
					},
				]
			});
		}
	
	var theMenu = electron.remote.Menu.buildFromTemplate (template);
	electron.remote.Menu.setApplicationMenu (theMenu);
	}
function shellSetupIpcHandlers () {
	console.log ("setupIpcHandlers");
	const ipcRenderer = require ("electron").ipcRenderer;
	ipcRenderer.on ("debugMessage", function (event, s) {
		console.log (s + " [main thread]");
		});
	ipcRenderer.send ("asynch-message", "hello");  //so the main thread knows how to call us
	ipcRenderer.on ("callback", function (event, verb, param1) {
		console.log ("callback: verb == " + verb + ", param1 == " + param1);
		var package = JSON.parse (param1);
		switch (verb) {
			case "consoleLog":
				console.log (package.text);
				break;
			case "msg":
				shellPrefs.msgs [package.path] = package.text;
				$("#idScriptMsg").text (jsonStringify (shellPrefs.msgs));
				prefsChanged ();
				break;
			case "alertDialog":
				alertDialog (package.text);
				break;
			case "speakerBeep": //6/1/17 by DW
				console.log ("callback: speakerBeep");
				speakerBeep ();
				break;
			case "op": //6/12/17 by DW
				switch (package.verb) {
					case "expand":
						opExpand (package.ctLevels);
						break;
					}
				break;
			}
		});
	ipcRenderer.on ("electronland", function (event, name, value) { //8/5/17 by DW
		
		console.log ("\nelectronland message received.\n");
		
		if (appOptions.ipcMessageCallback !== undefined) {
			
			console.log ("\nelectronland about to call callback.\n");
			
			appOptions.ipcMessageCallback (name, value);
			}
		});
	}
function shellOpenUrl (url) {
	require ("electron").ipcRenderer.send ("asynch-message", "openUrl", url);  
	}
function shellOpenFolder (folder) {
	require ("electron").ipcRenderer.send ("asynch-message", "openFolder", folder);  
	}
function shellOpenUserDataFolder () {
	shellOpenFolder (config.userDataFolder + "config.json");
	}
function shellOpenFileDialog (callback) {
	var options = {
		defaultPath: config.userDataFolder,
		properties: ["createDirectory", "openFile"] //6/12/17 by DW
		};
	console.log ("shellOpenFileDialog: options.defaultPath == " + options.defaultPath);
	electron.remote.dialog.showOpenDialog (options, function (theFiles) {
		if (theFiles !== undefined) {
			if (callback !== undefined) {
				callback (theFiles);
				}
			}
		}); 
	}
function shellNewFileDialog (callback) {
	var options = {
		title: "Name of the new file?",
		filters: [
			{name: 'text', extensions: config.acceptableFileExtensions}
			]
		};
	electron.remote.dialog.showSaveDialog (options, function (f) {
		if (f !== undefined) {
			console.log ("shellNewFileDialog: theFile == " + f);
			if (callback !== undefined) {
				callback (f);
				}
			}
		}); 
	}
function shellToggleTwitterConnect () {
	function waitForOAuth () {
		return (require ("electron").ipcRenderer.sendSync ("synchronous-message", "waitForOAuth"));
		}
	function specialConnect () {
		var myPort = waitForOAuth (); //starts up the HTTP server waiting for a response
		var urlMyLocation = "http://localhost:" + myPort + "/";
		console.log ("\nspecialConnect: urlMyLocation == " + urlMyLocation);
		var urlRedirectTo = config.urlTwitterServer + "connect?redirect_url=" + encodeURIComponent (urlMyLocation);
		console.log ("\nspecialConnect: urlRedirectTo == " + urlRedirectTo);
		window.location.href = urlRedirectTo;
		}
	if (twIsTwitterConnected ()) {
		confirmDialog ("Sign off Twitter?", function () {
			twDisconnectFromTwitter ();
			});
		}
	else {
		specialConnect ();
		}
	}
function shellRunScript (theScript, callback) {
	var flRunScriptInBrowser = false; //an experiment
	if (flRunScriptInBrowser) {
		try {
			callback (eval (theScript));
			}
		catch (err) {
			callback (undefined, err.message);
			}
		}
	else {
		var ipc = require ("electron").ipcRenderer;
		if (callback !== undefined) {
			ipc.once ("scriptReturnVal", function (event, val, errorMessage) {
				callback (val, errorMessage);
				});
			}
		ipc.send ("asynch-message", "runScript", theScript);  
		}
	}

//settings dialog
	var saveSettingsCallback = undefined;
	
	function settingsGetValuesFromDialog (appPrefs) {
		var inputs = document.getElementById ("idSettingsDialog").getElementsByTagName ("input"), i;
		for (var i = 0; i < inputs.length; i++) {
			if (inputs [i].type == "checkbox") {
				appPrefs [inputs [i].name] = inputs [i].checked;
				}
			else {
				appPrefs [inputs [i].name] = inputs [i].value;
				}
			}
		
		var textareas = document.getElementById ("idSettingsDialog").getElementsByTagName ("textarea"), i;
		for (var i = 0; i < textareas.length; i++) {
			appPrefs [textareas [i].name] = textareas [i].value;
			}
		}
	function settingsSetDefaultValues (appPrefs) {
		var inputs = document.getElementById ("idSettingsDialog").getElementsByTagName ("input"), i;
		for (var i = 0; i < inputs.length; i++) {
			if (appPrefs [inputs [i].name] != undefined) {
				if (inputs [i].type == "checkbox") {
					inputs [i].checked = appPrefs [inputs [i].name];
					}
				else {
					inputs [i].value = appPrefs [inputs [i].name];
					}
				}
			}
		
		var textareas = document.getElementById ("idSettingsDialog").getElementsByTagName ("textarea"), i;
		for (var i = 0; i < textareas.length; i++) {
			if (appPrefs [textareas [i].name] != undefined) {
				textareas [i].value = appPrefs [textareas [i].name];
				}
			}
		}
	function settingsCloseDialog (event) {
		try { //6/7/14 by DW
			concord.resumeListening (); //3/11/13 by DW
			}
		catch (err) {
			}
		
		if (event !== undefined) { //4/11/16 by DW
			event.stopPropagation ();
			}
		
		$("#idSettingsDialog").modal ('hide'); 
		};
	function settingsOkClicked () {
		settingsGetValuesFromDialog (prefs.appPrefs); 
		
		settingsCloseDialog ();
		prefsChanged ();
		
		if (appOptions.applySettingsCallback !== undefined) {
			appOptions.applySettingsCallback (prefs.appPrefs);
			}
		if (saveSettingsCallback !== undefined) {
			saveSettingsCallback (prefs.appPrefs);
			}
		};
	
	function shellOpenSettingsDialog (saveCallback) {
		saveSettingsCallback = saveCallback; 
		
		try { //6/7/14 by DW
			concord.stopListening (); //3/11/13 by DW
			}
		catch (err) {
			}
		
		$("#idSettingsDialog").modal ('show'); 
		settingsSetDefaultValues (prefs.appPrefs); 
		
		$("#idSettingsDialog").on ("keydown", function (event) { //1/26/15 by DW
			if (event.which == 13) {
				settingsOkClicked ();
				return (false);
				}
			});
		}
//prefs
	function getPrefs (callback) {
		var f = config.userDataFolder + fnamePrefs;
		fs.readFile (f, function (err, data) {
			if (err) {
				if (callback !== undefined) {
					callback ();
					}
				}
			else {
				try {
					var jstruct = JSON.parse (data.toString ());
					for (var x in jstruct) {
						prefs [x] = jstruct [x];
						}
					if (callback !== undefined) {
						callback ();
						}
					}
				catch (err) {
					console.log ("getPrefs: err.message == " + err.message);
					if (callback !== undefined) {
						callback ();
						}
					}
				}
			});
		}
	function setPrefs (callback) {
		var f = config.userDataFolder + fnamePrefs;
		prefs.ctPrefsSaves++;
		prefs.whenLastPrefsSave = new Date ();
		fs.writeFile (f, jsonStringify (prefs), function (err) {
			if (callback !== undefined) {
				callback ();
				}
			});
		}
	
	function shellGetPrefs (callback) {
		getPrefs (function () {
			if (callback !== undefined) {
				callback (prefs.appPrefs);
				}
			});
		}
	function shellSetPrefs (appPrefs) {
		for (var x in appPrefs) {
			prefs.appPrefs [x] = appPrefs [x];
			}
		prefsChanged ();
		}
	
	function prefsChanged () {
		flPrefsChanged = true;
		}
	
//tabs
	function addTab (tabtitle, tabfile) {
		var tab = {
			f: tabfile,
			title: tabtitle,
			flUpdateWaiting: false,
			flInstantOutline: false,
			flLocked: false,
			temp: new Object ()
			};
		var ixtab = prefs.myTabs.length;
		prefs.myTabs [ixtab] = tab;
		prefs.ixCurrentTab = ixtab;
		buildTabs ();
		prefsChanged ();
		return (tab);
		}
	function addInstantTab (url, jstruct) {
		var tab = {
			title: jstruct.title,
			flInstantOutline: true,
			flLocked: false,
			urlOutline: url,
			urlOpmlFile: jstruct.url,
			description: jstruct.description,
			socketserver: jstruct.socketserver,
			temp: new Object ()
			};
		var flTabFound = false;
		if (tab.socketserver === "undefined") {
			tab.socketserver = undefined;
			}
		var ixtab = prefs.myTabs.length;
		prefs.myTabs [ixtab] = tab;
		prefs.ixCurrentTab = ixtab;
		buildTabs ();
		prefsChanged ();
		return (tab);
		}
	function showHideTabs () {
		var displayval = "block";
		if (prefs.myTabs.length == 0) {
			displayval = "none";
			$("#idEditorContainer").empty (); //5/5/17 by DW 
			}
		$("#idTabsContainer").css ("display", displayval);
		}
	function buildTabs () {
		$("#idTabList").empty ();
		for (var i = 0; i < prefs.myTabs.length; i++) {
			var tab = prefs.myTabs [i], activetab = "", clickscript = "shell.tabClick (" + i + ")", icon, title, updateWaitingClass = "";
			if (i == prefs.ixCurrentTab) {
				activetab = " class=\"active\"";
				}
			else {
				if (tab.flUpdateWaiting) {
					updateWaitingClass = " iconUpdateWaiting "
					}
				}
			
			//set icon
				if (tab.flInstantOutline) {
					icon = "bolt";
					}
				else {
					icon = "file-text-o";
					}
				icon = "<i class=\"fa fa-" + icon + updateWaitingClass + "\"></i>";
			//set title
				title = "<span class=\"spTabTitleText\">" + tab.title + "</span>";
			
			$("#idTabList").append ("<li" + activetab + " id='tab" + i + "'><a data-toggle=\"tab\" onclick='" + clickscript + "'>"  + icon + title + "</a></li>");
			}
		showHideTabs ();
		}
	function releaseWaitingUpdate (tab) {
		sendUpdateToTab (prefs.ixCurrentTab, tab.updateData);
		delete tab.updateData;
		tab.flUpdateWaiting = false;
		updateLockIcon ();
		}
	function tabClick (ix, callback) {
		if (ix < prefs.myTabs.length) { //not out of range 
			var tab = prefs.myTabs [ix];
			prefs.ixCurrentTab = ix;
			if (tab.flUpdateWaiting) {
				if (!tab.flLocked) {
					releaseWaitingUpdate (tab);
					}
				}
			prefsChanged ();
			buildTabs ();
			updateLockIcon ();
			if (appOptions.tabClickCallback !== undefined) {
				appOptions.tabClickCallback (tab);
				}
			}
		}
	function closeTab (ixtab) {
		if (ixtab === undefined) {
			ixtab = prefs.ixCurrentTab;
			}
		if (appOptions.tabCloseCallback !== undefined) {
			appOptions.tabCloseCallback (prefs.myTabs [ixtab]); //delete any attached objects
			}
		prefs.myTabs.splice (prefs.ixCurrentTab, 1);
		var ixmax = prefs.myTabs.length - 1;
		if (prefs.ixCurrentTab > ixmax) {
			prefs.ixCurrentTab = ixmax;
			}
		buildTabs ();
		tabClick (prefs.ixCurrentTab);
		updateLockIcon ();
		prefsChanged ();
		}
	function getCurrentTab () {
		return (prefs.myTabs [prefs.ixCurrentTab]);
		}
	function sendUpdateToTab (ixtab, theData) {
		var tab = prefs.myTabs [ixtab];
		if ((ixtab == prefs.ixCurrentTab) && (!tab.flLocked)) {
			if (appOptions.tabUpdatedCallback !== undefined) {
				appOptions.tabUpdatedCallback (tab, theData);
				}
			}
		else {
			tab.flUpdateWaiting = true;
			tab.updateData = theData;
			buildTabs ();
			updateLockIcon ();
			}
		}
	function wsWatchForChange (ixtab) {
		var tab = prefs.myTabs [ixtab];
		if (tab.myChatLogSocket === undefined) {
			if (tab.socketserver !== undefined) { //4/28/17 by DW
				console.log ("wsWatchForChange: tab.socketserver == " + tab.socketserver);
				
				var theSocket = new WebSocket (tab.socketserver); 
				tab.myChatLogSocket = theSocket;
				
				theSocket.onopen = function (evt) {
					var msg = "watch " + tab.urlOpmlFile;
					console.log ("sending: \"" + msg + "\"");
					theSocket.send (msg);
					};
				theSocket.onmessage = function (evt) {
					var s = evt.data;
					if (s !== undefined) { //no error
						var updatekey = "update\r";
						if (beginsWith (s, updatekey)) { //it's an update
							var theData = stringDelete (s, 1, updatekey.length);
							console.log ("wsWatchForChange: update received, theData.length == " + theData.length);
							sendUpdateToTab (ixtab, theData);
							}
						}
					};
				theSocket.onclose = function (evt) {
					console.log ("tab.myChatLogSocket was closed.");
					tab.myChatLogSocket = undefined;
					};
				theSocket.onerror = function (evt) {
					console.log ("tab.myChatLogSocket received an error");
					};
				
				console.log ("wsWatchForChange: tab.myChatLogSocket == " + jsonStringify (tab.myChatLogSocket));
				}
			}
		}

function getTabsArray () { //so upper level can find out how many tabs there are, perhaps other info
	return (prefs.myTabs);
	}
function updateLockIcon () {
	if (prefs.myTabs.length > 0) {
		var tab = prefs.myTabs [prefs.ixCurrentTab];
		var enabledColor = "gray", disabledColor = "silver", updateWaitingColor = "green";
		
		function enabled (id, fl) {
			var color = (fl) ? enabledColor : disabledColor
			$("#" + id).css ("color", color);
			}
		
		enabled ("idLockIcon", tab.flInstantOutline);
		
		if (tab.flLocked) {
			classToRemove = "fa-unlock", classToAdd = "fa-lock";
			}
		else {
			classToRemove = "fa-lock", classToAdd = "fa-unlock";
			}
		$("#idLockIcon").removeClass (classToRemove);
		$("#idLockIcon").addClass (classToAdd);
		
		if (tab.flLocked && tab.flUpdateWaiting) {
			$("#idLockIcon").css ("color", updateWaitingColor);
			}
		}
	}
function lockIconClick () {
	var tab = prefs.myTabs [prefs.ixCurrentTab];
	tab.flLocked = !tab.flLocked;
	if (!tab.flLocked) {
		releaseWaitingUpdate (tab);
		}
	updateLockIcon ();
	prefsChanged ();
	}

function updateTwitterMenuItem () {
	document.getElementById ("idTwitterConnectMenuItem").innerHTML = (twIsTwitterConnected ()) ? "Sign off Twitter..." : "Sign on Twitter...";
	}
function updateTwitterUsername () {
	document.getElementById ("idTwitterUsername").innerHTML = (twIsTwitterConnected ()) ? localStorage.twScreenName : "Sign on here";
	}
function initMenus () {
	var cmdKeyPrefix = getCmdKeyPrefix (); //10/6/14 by DW
	document.getElementById ("idMenuProductName").innerHTML = config.productnameForDisplay; 
	document.getElementById ("idMenuAboutProductName").innerHTML = config.productnameForDisplay; 
	$("#idMenubar .dropdown-menu li").each (function () {
		var li = $(this);
		var liContent = li.html ();
		liContent = liContent.replace ("Cmd-", cmdKeyPrefix);
		li.html (liContent);
		});
	updateTwitterMenuItem ();
	updateTwitterUsername ();
	}
function everySecond () {
	if (flPrefsChanged) {
		flPrefsChanged = false;
		setPrefs ();
		}
	for (var i = 0; i < prefs.myTabs.length; i++) {
		var tab = prefs.myTabs [i];
		if (getBoolean (tab.flInstantOutline)) {
			wsWatchForChange (i);
			}
		}
	}
function cleanPrefsAtStartup () {
	for (var i = 0; i < prefs.myTabs.length; i++) { //values that don't persist betw invocations
		var tab = prefs.myTabs [i];
		tab.temp = new Object ();
		delete tab.myChatLogSocket;
		}
	}
function init (options, callback) {
	console.log ("shell.init");
	config = shellGetConfig (); //set global, it's synchronous
	$("#idPageTitle").text (config.productnameForDisplay); //5/5/17 by DW
	$("#idVersionNumber").html ("v" + config.version); 
	twStorageData.urlTwitterServer = config.urlTwitterServer;
	appOptions = options;
	getPrefs (function () {
		cleanPrefsAtStartup ();
		
		console.log ("shell.init: prefs == " + jsonStringify (prefs)); //4/28/17 by DW
		
		shellSetupIpcHandlers ();
		shellSetupSystemMenus ();
		twGetOauthParams (false); 
		tabClick (prefs.ixCurrentTab);
		
		$("#idTwitterIcon").html (twStorageConsts.fontAwesomeIcon);
		initMenus ();
		updateLockIcon ();
		
		if (appOptions.applySettingsCallback !== undefined) {
			if (prefs.appPrefs !== undefined) {
				appOptions.applySettingsCallback (prefs.appPrefs);
				}
			}
		self.setInterval (everySecond, 1000); 
		
		if (callback !== undefined) {
			callback (prefs.appPrefs);
			}
		});
	}
