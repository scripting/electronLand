const utils = require ("daveutils");
const electronland = require (__dirname + "/lib/electron.js"); 

var myConfig = {
	productname: "electronLandDemo",
	productnameForDisplay: "ElectronLand Demo",
	description: "Just a demo app.",
	userDataFolder: undefined,
	appDirname: __dirname, 
	version: "0.41d"
	}

function startup () {
	console.log (utils.padWithZeros (12, 5));
	electronland.init (myConfig, function () {
		});
	}

startup ();
