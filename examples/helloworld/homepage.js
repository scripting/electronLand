const shell = require ("electronland").shell; 

function toggleTwitterConnect () {
	shell.toggleTwitterConnect ()
	}
function everySecond () {
	initTwitterMenuItems ();
	}
function startup () {
	var options = {
		};
	shell.init (options, function (appPrefsFromStorage) {
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
