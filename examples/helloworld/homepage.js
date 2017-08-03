const shell = require ("electronland").shell; 

function showHelloWorldMessage () {
	if (twIsTwitterConnected ()) {
		$("#idLoggedonMessage").css ("display", "block");
		$("#idNotLoggedonMessage").css ("display", "none");
		}
	else {
		$("#idLoggedonMessage").css ("display", "none");
		$("#idNotLoggedonMessage").css ("display", "block");
		}
	}
function everySecond () {
	initTwitterMenuItems ();
	showHelloWorldMessage ();
	}
function startup () {
	var options = {
		};
	shell.init (options, function (appPrefsFromStorage) {
		initTwitterMenuItems ();
		if (twIsTwitterConnected ()) {
			twGetUserInfo (twGetScreenName (), function (userinfo) {
				twUserInfo = userinfo;
				$("#idUserName").text (userinfo.name);
				showHelloWorldMessage ();
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
