const electronland = require ("electronland").main; 

var myConfig = {
	productname: "helloWorld",
	productnameForDisplay: "Hello World",
	description: "The Hello World app for electronLand.",
	version: "0.4.0",
	indexfilename: "index.html",
	mainWindowWidth: 800,
	mainWindowHeight: 600,
	appDirname: __dirname
	}

electronland.init (myConfig, function () {
	});
