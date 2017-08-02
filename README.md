# electronLand

My shell for Electron apps, along with Electron Outliner.

For now a private repo. This serves as a backup of what's on my local system.

## How the pieces fit together

package.json in the app folder says to run main.js when the app starts. 

main.js is the simplest of shells. It loads config.json from the app directory and feeds it to electronland.init. **docufiction

config.json in the app folder has a value called <i>indexfilename</i> this is where the linkage is created to the app that's running in the shell. It defines where everything else is. 

In our example, the code is in outlinerindex.html. It defaults to index.html.

Then in the code running in the index page, we get access to the shell through a require. 

## Next steps

Reorganize the code, into a package, called electronland that's in NPM. 

In the index page code:

const shell = require ("electronland").shell;

In main.js we say:

const electronland = require ("electronland").main;

The design works because it reflects the split in the design of Electron, but it gets us all the functionality buried beneath a relatively simple interface.

