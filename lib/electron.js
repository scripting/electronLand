exports.init = init;

const fs = require ("fs");  
const http = require ("http");
const urlpack = require ("url");
const electron = require ("electron");
const utils = require ("daveutils");

var mainWindow = null; 
var flOpenUrlsInExternalBrowser = true, urlMainWindow; 
var bullMancuso = undefined;

var config = {
	userDataFolder: undefined,
	flOpenDevToolsAtStart: false,
	flPreventAppSuspension: false,
	mainWindowWidth: 1100,
	mainWindowHeight: 1000,
	iconPath: "app.png",
	urlTwitterServer: "http://twitter.porkchop.io/",
	oauthWaitPort: 1403,
	
	indexfilename: "outlinerindex.html", //5/1/17 by DW
	acceptableFileExtensions: ["opml"]
	
	};
var fnameConfig = "config.json";

var stats = {
	ctStarts: 0,
	ctSeconds: 0,
	ctStatsWrites: 0
	};
var fnameStats = "stats.json", flStatsChanged = false;

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
function fsSureFilePathSync (path) { 
	var splits = path.split ("/");
	path = ""; 
	if (splits.length > 0) {
		function doLevel (levelnum) {
			if (levelnum < (splits.length - 1)) {
				path += splits [levelnum] + "/";
				if (fs.existsSync (path)) {
					doLevel (levelnum + 1);
					}
				else {
					fs.mkdirSync (path, undefined);
					doLevel (levelnum + 1);
					}
				}
			}
		doLevel (0);
		}
	return (true);
	}
function fsSureFilePath (path, callback) { 
	var splits = path.split ("/");
	path = ""; //1/8/15 by DW
	if (splits.length > 0) {
		function doLevel (levelnum) {
			if (levelnum < (splits.length - 1)) {
				path += splits [levelnum] + "/";
				fs.exists (path, function (flExists) {
					if (flExists) {
						doLevel (levelnum + 1);
						}
					else {
						fs.mkdir (path, undefined, function () {
							doLevel (levelnum + 1);
							});
						}
					});
				}
			else {
				if (callback != undefined) {
					callback ();
					}
				}
			}
		doLevel (0);
		}
	else {
		if (callback != undefined) {
			callback ();
			}
		}
	}
function fsSureFolder (folder, callback) {
	fsSureFilePath (folder + "x", callback);
	return (folder);
	}
function fsIsFolder (path) {
	return (fs.statSync (path).isDirectory ());
	}
function getLocalFilePath (relpath) {
	return (config.userDataFolder + relpath);
	}
function writeUserDataFile (path, config) {
	var f = getLocalFilePath (path);
	fsSureFilePath (f, function () {
		fs.writeFile (f, utils.jsonStringify (config), function (err) {
			if (err) {
				debugMessage ("writeUserDataFile: error writing file " + f + " == " + err.message);
				}
			});
		});
	}
function readUserDataFile (path, config, callback) {
	var f = getLocalFilePath (path);
	debugMessage ("readUserDataFile: f == " + f);
	fsSureFilePath (f, function () {
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
		flOpenDevToolsAtStart: config.flOpenDevToolsAtStart
		};
	fsSureFilePath (f, function () {
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
	fsSureFilePath (f, function () {
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
	fsSureFilePath (f, function () {
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
		mainWindow = new electron.BrowserWindow ({
			width: config.mainWindowWidth, 
			height: config.mainWindowHeight,
			icon: __dirname + "/" + config.iconPath
			});
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
		debugMessage ("defaultHandleAsyncMessage: " + arg1 + ", arg2 == " + arg2 + ", arg3 == " + arg3);
		switch (arg1) {
			case "hello":
				bullMancuso = event.sender;
				debugMessage ("hello message received");
				bullMancuso.send ("config", utils.jsonStringify (config));
				break;
			case "openUrl": 
				electron.shell.openExternal (arg2);
				break;
			case "openFolder": 
				electron.shell.showItemInFolder (arg2);
				break;
			case "setConfig": //4/21/17 by DW
				var theConfigSubset = JSON.parse (arg2);
				for (x in theConfigSubset) {
					config [x] = theConfigSubset [x];
					}
				updateConfigJson (theConfigSubset);
				break;
			}
		});
	electron.ipcMain.on ("synchronous-message", function (event, arg) {
		debugMessage ("IPC message received == " + arg);
		switch (arg) {
			case "waitForOAuth":
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
	console.log ("electronOpenHomePage: urlMainWindow == " + urlMainWindow);
	mainWindow.loadURL (urlMainWindow);
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
	
	if (config !== undefined) {
		for (x in configParam) {
			config [x] = configParam [x];
			}
		}
	
	console.log ("electronLand.init: config == " + utils.jsonStringify (config));
	
	electronStartup ();
	config.userDataFolder = electron.app.getPath ("userData") + "/" + config.productname + "/"; 
	fsSureFolder (config.userDataFolder, function () {
		readConfig (fnameConfig, config, function () {
			readUserDataFile (fnameConfig, config, function () {
				console.log ("startup config == " + utils.jsonStringify (config));
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
