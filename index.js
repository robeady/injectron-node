const chrome = require('chrome-remote-interface');
const getPort = require('get-port');
const child_process = require('child_process');
const commander = require('commander');
const fs = require("fs");
const path = require("path")


async function main() {
    const port = await getPort();
    const args = parseArgs();

    try {
        spawn_app(args.args, port);

        const scriptsToInject = getScriptsToInject(args);
        const jsPatchers = args.jsPatch.map(parsePatcher);

        await connectAndInject(port, scriptsToInject, jsPatchers);
        // don't wait around for more messages
        process.exit(0);
    } catch (ex) {
        console.log(ex);
    }
}

function parseArgs() {
    return commander
        .option("--css <path>", "blah", collect, [])
        .option("--js <path>", "blah", collect, [])
        .option("--jsPatch <path>", "blah", collect, [])
        .parse(process.argv)
}

function collect(val, so_far) {
    so_far.push(val);
    return so_far;
}


function spawn_app(cmd, port) {
    cmd.push(`--remote-debugging-port=${port}`);
    console.log(`spawning: [${cmd}]`);
    spawn(cmd[0], cmd.slice(1));
}

function spawn(command, args) {
    try {
        const proc = child_process.spawn(command, args, { detached: true });
        proc.on('error', die_due_to_spawn_error);
        proc.unref();
    } catch (error) {
        die_due_to_spawn_error(error)
    }
}

function die_due_to_spawn_error(error) {
    console.log(`error spawning command, ${error}`);
    process.exit(1);
}


function getScriptsToInject(args) {
    const scripts = [];
    for (css of args.css) {
        scripts.push(wrap_css(fs.readFileSync(css, "utf8")));
    }
    for (js of args.js) {
        scripts.push(fs.readFileSync(js, "utf8"));
    }
    return scripts;
}

function wrap_css(css) {
    return fs.readFileSync(path.join(__dirname, "insert_css.js"), "utf8") + "insert_css(`" + css + "`);";
}

function parsePatcher(filePath) {
    return eval(fs.readFileSync(filePath, "utf8"));
}


async function connectAndInject(port, scriptsToInject, jsPatchers) {
    const alreadyInjected = [];
    // try multiple times allowing for the appearance of new targets as the app starts
    const times = 5;
    for (var i = 0; i < times; i++) {
        const targets = await chrome.List({port: port});
        Promise.all(targets.map(async (target) => inject(port, target, alreadyInjected, scriptsToInject, jsPatchers)));
        await sleep(1000);
    }
    // patching and injecting might take a while
    await sleep(10000);
}


async function inject(port, target, alreadyInjected, scriptsToInject, jsPatchers) {
    if (alreadyInjected.includes(target.id)) {
        return;
    }
    alreadyInjected.push(target.id);

    const client = await chrome({port: port, target: target});
    const {Debugger, Runtime} = client;

    await Debugger.scriptParsed(async args => {
        try {
            for (patcher of jsPatchers) {
                if (patcher.shouldPatch(args.url)) {
                    const {scriptSource} = await Debugger.getScriptSource({scriptId: args.scriptId});
                    console.log(`computing patch for script '${args.url}' in target ${target.id}`);
                    const newSource = await patcher.patch(scriptSource);
                    console.log(`patching script '${args.url}' in target ${target.id}`);
                    const result = await Debugger.setScriptSource({scriptId: args.scriptId, scriptSource: newSource});
                    console.log("patched '%s' with result %j", args.url, result);
                    break;
                }
            }
        } catch (ex) {
            console.exception(ex);
        }
    });
    await Debugger.enable();

    // experiment with patching html is disabled for now...

    // Page.enable();
    // if (htmlPatcher != null) {
    //     const r = await Runtime.evaluate({expression: "document.documentElement.outerHTML"});
    //     const html = r.result.value;

    //     const rl = await Runtime.evaluate({expression: "document.location.toString()"});
    //     const location = rl.result.value;

    //     const {frameId} = await Page.navigate({url: location});
    //     if (html != null) {
    //         const newHtml = await htmlPatcher.patch(html);
    //         await Page.setDocumentContent({
    //             frameId: frameId,
    //             html: newHtml
    //         });
    //         console.log(`patched html successfully in target ${target.id}, frame ${frameId}`);
    //     } else {
    //         console.error("did not patch html");
    //         console.error(r);
    //     }
    // }

    for (script of scriptsToInject) {
        console.log(`injecting script into target ${target.id}`);
        const result = await Runtime.evaluate({expression: script});
        console.log(result);
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();
