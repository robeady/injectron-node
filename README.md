# injectron-node

Injects CSS and JS files into closed source electron applications.

Injected JS will be evaluated; for injected CSS, a script will be injected that adds the CSS to the main stylesheet.

This script will launch the target app then attempt injection into every discovered window/webview over a period of several seconds.

## Usage

    node index.js --css custom.css --js custom.js path/to/electron/app
    
Multiple css and js files may be specified, just repeat the arguments, e.g.

    node index.js --css custom1.css --css custom2.css path/to/electron/app
    
## Advanced: patching scripts

You can also supply a specification of how to patch javascript files loaded by the app.
Note that this seems only to work for relatively small scripts.

Create a JS patch file with contents:

    ({
        shouldPatch: scriptUrl => /* return true iff script should be patched */,
        patch: scriptSource => /* return patched script contents as a string */
    })

The arguments `scriptUrl` and `scriptSource` are strings.

You can specify multiple patches. They will be tried sequentially for each script: the first patch that returns true from `shouldPatch` will be used to patch a particular script.

Usage:

    node index.js --jsPatch patch.js path/to/electron/app
    
Patches can of course be combined with ordinary CSS and JS injection.


