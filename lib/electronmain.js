var myProductName = "electronLand", myVersion = "0.4.42";   

exports.init = init;
exports.getConfig = function () { //8/5/17 by DW
	return (config);
	}
exports.sendIpcToBrowser = sendIpcToBrowser; //8/5/17 by DW
exports.debugMessage = debugMessage; //8/8/17 by DW

const fs = require ("fs");  
const http = require ("http");
const request = require ("request");
const urlpack = require ("url");
const electron = require ("electron");
const utils = require ("daveutils");

var mainWindow = null; 
var flOpenUrlsInExternalBrowser = true, urlMainWindow; 
var bullMancuso = undefined;

var config = {
	indexfilename: "index.html", 
	acceptableFileExtensions: ["txt", "js", "xml", "html"],
	userDataFolder: undefined,
	nameUserDataFolder: "data",
	flOpenDevToolsAtStart: false,
	flPreventAppSuspension: false,
	mainWindowWidth: 1100,
	mainWindowHeight: 1000,
	iconPath: "app.png",
	urlTwitterServer: "http://twitter.porkchop.io/",
	oauthWaitPort: 1403,
	asyncMessageCallback: undefined //8/8/17 by DW
	};
var fnameConfig = "config.json";

var stats = {
	ctStarts: 0,
	ctSeconds: 0,
	ctStatsWrites: 0,
	ctScriptRuns: 0,
	whenLastScriptRun: undefined
	};
var fnameStats = "stats.json", flStatsChanged = false;

var localStorage = {
	};


function sendIpcToBrowser (name, value) { //8/5/17 by DW
	if (bullMancuso !== undefined) {
		bullMancuso.send ("electronland", name, value);
		return (true);
		}
	else {
		return (false);
		}
	}
function debugMessage (s) {
	console.log (s);
	try {
		if (bullMancuso !== undefined) {
			bullMancuso.send ("debugMessage", s);
			}
		}
	catch (err) {
		}
	}
function statsChanged () {
	flStatsChanged = true;
	}
function getLocalFilePath (relpath) {
	return (config.userDataFolder + relpath);
	}
function writeUserDataFile (path, config) {
	var f = getLocalFilePath (path);
	utils.sureFilePath (f, function () {
		fs.writeFile (f, utils.jsonStringify (config), function (err) {
			if (err) {
				debugMessage ("writeUserDataFile: error writing file " + f + " == " + err.message);
				}
			});
		});
	}
function readUserDataFile (path, config, callback) {
	var f = getLocalFilePath (path);
	utils.sureFilePath (f, function () {
		fs.readFile (f, function (err, data) {
			if (!err) {
				try {
					var jstruct = JSON.parse (data.toString ());
					for (var x in jstruct) {
						config [x] = jstruct [x];
						}
					}
				catch (err) {
					debugMessage ("readUserDataFile: err == " + err.message);
					}
				}
			if (callback !== undefined) {
				callback ();
				}
			});
		});
	}
function sureConfigJson (callback) { //4/18/17 by DW
	var f = getLocalFilePath (fnameConfig);
	var initConfig = {
		};
	utils.sureFilePath (f, function () {
		fs.readFile (f, function (err, data) {
			if (err) {
				try {
					fs.writeFile (f, utils.jsonStringify (initConfig), function (err) {
						});
					}
				catch (err) {
					debugMessage ("sureConfigJson: err == " + err.message);
					}
				}
			if (callback !== undefined) {
				callback ();
				}
			});
		});
	}
function updateConfigJson (theConfigSubset, callback) { //4/21/17 by DW
	var f = getLocalFilePath (fnameConfig);
	utils.sureFilePath (f, function () {
		fs.readFile (f, function (err, data) {
			var theFullConfig = new Object ();
			if (!err) {
				try {
					theFullConfig = JSON.parse (data.toString ());
					}
				catch (err) {
					}
				}
			for (var x in theConfigSubset) {
				theFullConfig [x] = theConfigSubset [x]; 
				}
			fs.writeFile (f, utils.jsonStringify (theFullConfig), function (err) {
				});
			if (callback !== undefined) {
				callback ();
				}
			});
		});
	}
function readConfig (f, config, callback) {
	console.log ("readConfig: f == " + f); 
	utils.sureFilePath (f, function () {
		fs.readFile (f, function (err, data) {
			if (!err) {
				try {
					var jstruct = JSON.parse (data.toString ());
					console.log (utils.jsonStringify (jstruct)); 
					for (var x in jstruct) {
						config [x] = jstruct [x];
						}
					}
				catch (err) {
					debugMessage ("readConfig: err == " + err.message);
					}
				}
			if (callback !== undefined) {
				callback ();
				}
			});
		});
	}
function runUserScript (s, scriptName) {
	var now = new Date ();
	function msg (s) {
		var package = {
			text: s,
			path: scriptName
			};
		bullMancuso.send ("callback", "msg", utils.jsonStringify (package));
		}
	function persist (objectName) {
		if (localStorage [objectName] === undefined) {
			localStorage [objectName] = new Object ();
			}
		return (localStorage [objectName]);
		}
	var number = {
		random: function (lower, upper) {
			return (utils.random (lower, upper));
			}
		}
	var file = {
		readWholeFile: function (path) {
			return (fs.readFileSync (path).toString ());
			},
		writeWholeFile: function (path, data) {
			return (fs.writeFileSync (path, data));
			},
		exists: function (path) {
			return (fs.existsSync (path));
			},
		getDatePath: function (theDate, flLastSeparator) {
			return (utils.getDatePath (theDate, flLastSeparator));
			},
		sureFilePath: function (path) {
			return (utils.sureFilePathSync (path));
			},
		copy: function (source, dest) {
			return (file.writeWholeFile (dest, file.readWholeFile (source)));
			},
		isFolder: function (path) {
			return (fs.statSync (path).isDirectory ());
			},
		getFileList: function (folderpath) {
			return (fs.readdirSync (folderpath));
			},
		getPathChar: function () {
			return ("/"); //must be made cross-platform -- 2/17/17 by DW
			},
		fileFromPath: function (f) {
			return (string.lastField (f, file.getPathChar ()));
			},
		newFolder: function (path) {
			return (fs.mkdirSync (path));
			},
		folderFromPath: function (f) {
			var pc = file.getPathChar ();
			return (string.popLastField (f, pc) + pc);
			},
		getUserDataFolder: function () {
			return (appConsts.userDataFolder + "/");
			}
		}
	var http = {
		readUrl: function (url, callback) {
			request (url, function (err, response, body) {
				if (callback !== undefined) {
					if (err) {
						callback (undefined);
						}
					else {
						callback (body.toString ());
						}
					}
				});
			}
		}
	var s3 = {
		newObject: function (path, text, type, callback) {
			var s = text.toString ();
			s3Lib.newObject (path, s, type, undefined, function (err, data) {
				if (callback !== undefined) {
					callback (err, data);
					}
				});
			},
		getObject: function (path, callback) {
			s3Lib.getObject (path, function (err, data) {
				if (callback !== undefined) {
					if (err) {
						callback (undefined, err);
						}
					else {
						callback (data);
						}
					}
				});
			}
		}
	var string = {
		beginsWith: utils.beginsWith,
		contains: utils.stringContains,
		countFields: utils.stringCountFields,
		dayOfWeekToString: utils.dayOfWeekToString,
		delete: utils.stringDelete,
		endsWith: utils.endsWith,
		filledString: utils.filledString,
		getRandomPassword: utils.getRandomPassword,
		getRandomSnarkySlogan: utils.getRandomSnarkySlogan,
		hashMD5: function (s) {
			return (crypto.createHash ("md5").update (s).digest ("hex"));
			},
		innerCaseName: utils.innerCaseName,
		insert: function (source, dest, ix) {
			ix--; //our version is 1-based
			return (dest.substr (0, ix) + source + dest.substr (ix));
			},
		isAlpha: utils.isAlpha,
		isNumeric: utils.isNumeric,
		lastField: utils.stringLastField,
		lower: utils.stringLower,
		mid: utils.stringMid,
		monthToString: utils.monthToString, //January, February etc.
		multipleReplaceAll: utils.multipleReplaceAll, //1/18/17 by DW
		nthField: utils.stringNthField,
		padWithZeros: utils.padWithZeros,
		popExtension: utils.stringPopExtension, //1/18/17 by DW
		popLastField: utils.stringPopLastField,
		popTrailing: function (s, ch) { //11/25/13 by DW
			while (s.length > 0) {
				if (s [s.length - 1] != ch) {
					break;
					}
				s = string.delete (s, s.length, 1);
				}
			return (s);
			},
		replaceAll: utils.replaceAll,
		stripMarkup: utils.stripMarkup,
		trimLeading: function (s, ch) {
			if (ch == undefined) {
				ch = " ";
				}
			return (utils.trimLeading (s, ch));
			},
		trimTrailing: function (s, ch) {
			if (ch == undefined) {
				ch = " ";
				}
			return (utils.trimTrailing (s, ch));
			},
		trimWhitespace: utils.trimWhitespace,
		upper: utils.stringUpper
		}
	var dialog = {
		alert: function (s) {
			var package = {
				text: s,
				path: scriptName
				};
			bullMancuso.send ("callback", "alertDialog", utils.jsonStringify (package));
			},
		ask: function (prompt, defaultValue, placeholder, callback) {
			
			
			bullMancuso.send ("askDialog", prompt, defaultValue, placeholder, callback);
			
			
			}
		}
	var date = {
		netStandardString: function (theDate) { //12/17/13 by DW
			return (theDate.toUTCString ());
			},
		secondsSince: utils.secondsSince
		}
	var clock = {
		now: function () {
			return (new Date ());
			},
		waitSeconds: function (ctsecs) {
			
			return (sleep (ctsecs * 1000));
			
			}
		}
	var speaker = {
		beep: function () {
			debugMessage ("runUserScript: speaker.beep ()");
			bullMancuso.send ("callback", "speakerBeep", utils.jsonStringify ({}));
			}
		}
	var webBrowser = { 
		openUrl: function (url) {
			electron.shell.openExternal (url); //5/10/17 by DW
			}
		}
	var twitter = { 
		getMyName: function (callback) {
			return (twitterLib.getScreenName (callback));
			},
		tweet: function (theTweet, callback) {
			return (twitterLib.tweet (theTweet, undefined, debugMessage, callback));
			}
		
		
		
		}
	var fargo = { //11/29/13 by DW
		version: function () {
			return (appConsts.version);
			},
		productname: function () {
			return (appConsts.productname);
			},
		productnameForDisplay: function () {
			return (appConsts.productnameForDisplay);
			}
		}
	var op = {
		expand: function () {
			var package = {
				verb: "expand",
				ctLevels: 1
				};
			bullMancuso.send ("op", utils.jsonStringify (package));
			
			return (true);
			},
		expandAllLevels: function () {
			return ($(opGetActiveOutliner ()).concord ().op.expandAllLevels ());
			},
		expandEverything: function () {
			return ($(opGetActiveOutliner ()).concord ().op.fullExpand ());
			},
		expandTo: function (headline) {
			expandToCursor (headline);
			return (setCursorActive (headline.getCursor ()));
			},
		collapse: function () {
			return ($(opGetActiveOutliner ()).concord ().op.collapse ());
			},
		collapseEverything: function () {
			return ($(opGetActiveOutliner ()).concord ().op.fullCollapse ());
			},
		
		go: function (dir, ct) {
			if (dir == right) {
				op.expand ();
				}
			return ($(opGetActiveOutliner ()).concord ().op.go (dir, ct));
			},
		firstSummit: function () {
			opFirstSummit ();
			return (true);
			},
		countSubs: function () {
			return ($(opGetActiveOutliner ()).concord().op.countSubs ());
			},
		hasSubs: function () {
			return (op.countSubs () > 0);
			},
		getLineText: function () {
			return ($(opGetActiveOutliner ()).concord ().op.getLineText ());
			},
		setLineText: function (s) { //8/7/13 by DW
			return ($(opGetActiveOutliner ()).concord ().op.setLineText (s));
			},
		
		insert: function (s, direction) {
			return ($(opGetActiveOutliner ()).concord ().op.insert (s, direction));
			},
		reorg: function (dir, ct) {
			if (ct == undefined) {
				ct = 1;
				}
			return ($(opGetActiveOutliner ()).concord ().op.reorg (dir, ct));
			},
		promote: function () {
			return ($(opGetActiveOutliner ()).concord ().op.promote ());
			},
		demote: function () {
			return ($(opGetActiveOutliner ()).concord ().op.demote ());
			},
		deleteSubs: function () {
			return ($(opGetActiveOutliner ()).concord ().op.deleteSubs ());
			},
		
		getCursorOpml: function () {
			return ($(opGetActiveOutliner ()).concord ().op.cursorToXml ());
			},
		insertOpml: function (opmltext, dir) {
			if (dir == undefined) {
				dir = down;
				}
			return ($(opGetActiveOutliner ()).concord ().op.insertXml (opmltext, dir));
			},
		
		bold: function () {
			return ($(opGetActiveOutliner ()).concord ().op.bold ());
			},
		italic: function () {
			return ($(opGetActiveOutliner ()).concord ().op.italic ());
			},
		strikethrough: function () {
			return ($(opGetActiveOutliner ()).concord ().op.strikethrough ());
			},
		link: function () {
			return ($(opGetActiveOutliner ()).concord ().op.link ());
			},
		
		isComment: function () {
			var isComment = op.attributes.getOne ("isComment")
			if ((isComment == undefined) || (isComment == "false")) {
				return (false);
				}
			else {
				return (true);
				}
			},
		unComment: function () {
			op.attributes.deleteOne ("isComment");
			return ($(opGetActiveOutliner ()).concord ().script.unComment ());
			},
		makeComment: function () {
			op.attributes.setOne ("isComment", "true");
			return ($(opGetActiveOutliner ()).concord ().script.makeComment ());
			},
		toggleComment: function () {
			if (op.isComment ()) {
				op.unComment ();
				}
			else {
				op.makeComment ();
				}
			},
		
		setRenderMode: function (flrendermode) { //7/28/13 by DW
			$(opGetActiveOutliner ()).concord ().op.setRenderMode (flrendermode);
			},
		getRenderMode: function () { //7/28/13 by DW
			return ($(opGetActiveOutliner ()).concord ().op.getRenderMode ());
			},
		toggleRenderMode: function () { //7/28/13 by DW
			op.setRenderMode (!op.getRenderMode ());
			},
		
		getCursor: function () {
			return ($(opGetActiveOutliner ()).concord ().op.getCursorRef ());
			},
		getCursorUrl: function () {
			var parent = undefined;
			op.visitToSummit (function (headline) {
				var type = headline.attributes.getOne ("type");
				if (type != undefined) {
					parent = headline;
					return (false); 
					}
				return (true); 
				});
			return (getTrexUrl (opGetActiveOutliner (), parent, true));
			},
		
		runSelection: function () {
			var value = eval (op.getLineText ());
			op.deleteSubs ();
			op.insert (value, right);
			op.go (left, 1);
			},
		setModified: function () {
			return ($(opGetActiveOutliner ()).concord ().op.markChanged ());
			},
		getModified: function () {
			return ($(opGetActiveOutliner ()).concord ().op.changed ());
			},
		setTextMode: function (fltextmode) {
			$(opGetActiveOutliner ()).concord ().op.setTextMode (fltextmode);
			},
		visitSubs: function (lineCallback, indentCallback, outdentCallback) {
			var levelnum = 0;
			var visitSub = function (sub) {
				lineCallback (sub, levelnum);
				if (sub.countSubs () > 0) {
					if (indentCallback != undefined) {
						indentCallback (levelnum);
						}
					levelnum++;
					sub.visitLevel (visitSub); 
					levelnum--; 
					if (outdentCallback != undefined) {
						outdentCallback (levelnum);
						}
					}
				return (true);
				};
			op.getCursor ().visitLevel (visitSub);
			},
		visitAll: function (callback) {
			return ($(opGetActiveOutliner ()).concord ().op.visitAll (callback));
			},
		visitToSummit: function (callback) {
			return ($(opGetActiveOutliner ()).concord ().op.visitToSummit (callback));
			},
		attributes: {
			getAll: function () {
				return ($(opGetActiveOutliner ()).concord ().op.attributes.getAll ());
				},
			getOne: function (name) {
				return $(opGetActiveOutliner ()).concord ().op.attributes.getOne (name);
				},
			setOne: function (name, value) {
				return $(opGetActiveOutliner ()).concord ().op.attributes.setOne (name, value);
				},
			addGroup: function (atts) {
				return $(opGetActiveOutliner ()).concord ().op.attributes.setGroup (atts);
				},
			deleteOne: function (name) {
				var atts = op.attributes.getAll ();
				if (atts [name] != undefined) {
					delete atts [name];
					}
				op.attributes.addGroup (atts);
				},
			makeEmpty: function () {
				var atts = new Object ();
				op.attributes.addGroup (atts);
				}
			}
		}
	stats.ctScriptRuns++;
	stats.whenLastScriptRun = now;
	statsChanged ();
	with (localStorage) {
		return (eval (s));
		}
	}

function handleAsyncMessage (event, arg1, arg2, arg3) {
	var flHandled = false;
	if (config.asyncMessageCallback !== undefined) {
		flHandled = config.asyncMessageCallback (event, arg1, arg2, arg3);
		}
	if (!flHandled) {
		switch (arg1) {
			case "hello":
				bullMancuso = event.sender;
				debugMessage ("hello message received");
				bullMancuso.send ("config", utils.jsonStringify (config));
				break;
			case "runScript":
				var val;
				debugMessage ("runScript: " + arg2);
				try {
					val = runUserScript (arg2, "quickscript");
					debugMessage ("runScript: val == " + val);
					event.sender.send ("scriptReturnVal", val);
					}
				catch (err) {
					debugMessage ("runScript: err.message == " + err.message);
					event.sender.send ("scriptReturnVal", undefined, err.message);
					}
				break;
			case "openUrl": 
				electron.shell.openExternal (arg2);
				break;
			case "openFolder": 
				electron.shell.showItemInFolder (arg2);
				break;
			case "openItem": //9/7/17 by DW
				electron.shell.openItem (arg2);
				break;
			case "setConfig": //4/21/17 by DW
				var theConfigSubset = JSON.parse (arg2);
				for (x in theConfigSubset) {
					config [x] = theConfigSubset [x];
					}
				updateConfigJson (theConfigSubset);
				break;
			}
		}
	}
function electronStartup () {
	var myHttpServer = undefined;
	function tinyHttpServer (httpRequest, httpResponse) {
		var parsedUrl = urlpack.parse (httpRequest.url, true);
		debugMessage ("tinyHttpServer: parsedUrl == \n" + JSON.stringify (parsedUrl, undefined, 4));
		httpResponse.writeHead (200, {"Content-Type": "text/plain"});
		httpResponse.end ("Welcome to the camp!");
		if (parsedUrl.search.length > 0) { //don't open a window for /favicon.ico for example -- 4/16/16 by DW
			electronOpenHomePage (parsedUrl.search);
			}
		}
	if (config.flPreventAppSuspension) {
		electron.powerSaveBlocker.start ("prevent-app-suspension");
		}
	electron.app.on ("ready", function () { 
		const options = {
			width: config.mainWindowWidth, 
			height: config.mainWindowHeight,
			webPreferences: { //11/22/19 by DW
				nodeIntegration: true
				},
			icon: __dirname + "/" + config.iconPath
			};
		console.log ("electronStartup: options == " + utils.jsonStringify (options)); //11/22/19 by DW
		mainWindow = new electron.BrowserWindow (options);
		mainWindow.on ("closed", function () {
			mainWindow = null;
			});
		mainWindow.webContents.on ("will-navigate", function (event, url) { 
			if (flOpenUrlsInExternalBrowser) { 
				electron.shell.openExternal (url);
				event.preventDefault ();
				}
			if (utils.beginsWith (urlMainWindow, url)) {
				setTimeout (function () {
					debugMessage ("About to set flOpenUrlsInExternalBrowser true.");
					flOpenUrlsInExternalBrowser = true;
					}, 1000);
				}
			});
		});
	electron.app.on ("window-all-closed", function () { 
		electron.app.quit ();
		});
	electron.ipcMain.on ("asynch-message", function (event, arg1, arg2, arg3) {
		handleAsyncMessage (event, arg1, arg2, arg3);
		});
	electron.ipcMain.on ("synchronous-message", function (event, arg) {
		switch (arg) {
			case "waitForOAuth":
				console.log ("waitForOAuth.");
				flOpenUrlsInExternalBrowser = false; 
				if (myHttpServer === undefined) { //4/15/16 by DW -- can't do this twice
					myHttpServer = http.createServer (tinyHttpServer);
					myHttpServer.listen (config.oauthWaitPort);
					}
				event.returnValue = config.oauthWaitPort;
				break;
			case "getConfig": //4/21/17 by DW
				event.returnValue = utils.jsonStringify (config);
				break;
			}
		});
	}
function electronOpenHomePage (queryString) {
	urlMainWindow = "file://" + config.appDirname + "/" + config.indexfilename + queryString; //set global
	mainWindow.loadURL (urlMainWindow);
	
	if (config.flOpenDevToolsAtStart) { 
		mainWindow.webContents.openDevTools ();
		}
	}
function everySecond () {
	var now = new Date ();
	stats.ctSeconds++; 
	stats.whenLastEverySecond = now;
	if (flStatsChanged) {
		flStatsChanged = false;
		stats.ctStatsWrites++;
		stats.whenLastStatsWrite = now;
		writeUserDataFile (fnameStats, stats);
		}
	}

function init (configParam, callback) {
	var now = new Date ();
	
	if (configParam !== undefined) {
		for (x in configParam) {
			config [x] = configParam [x];
			}
		}
	
	console.log ("electronLand.init: config == " + utils.jsonStringify (config));
	
	electronStartup ();
	config.userDataFolder = electron.app.getPath ("userData") + "/" + config.nameUserDataFolder + "/";  //8/3/17 by DW
	utils.sureFolder (config.userDataFolder, function () {
		readConfig (config.appDirname + "/" + fnameConfig, config, function () {
			readUserDataFile (fnameConfig, config, function () {
				readUserDataFile (fnameStats, stats, function () {
					stats.ctStarts++;
					stats.whenLastStart = now;
					statsChanged ();
					sureConfigJson (); //make sure there's a config.json in the user's data directory
					electronOpenHomePage ("");
					setInterval (everySecond, 1000); 
					if (callback !== undefined) {
						callback ();
						}
					});
				});
			});
		});
	}
