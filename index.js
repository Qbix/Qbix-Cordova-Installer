/**
 * Created by adventis on 3/17/18.
 */
var shell = require('shelljs');
var shellEmulator = require('shelljs');
var path = require('path');
var fs = require('fs');
var fs_extra = require('fs-extra');
var url = require('url');
xml2js = require('xml2js');
var plist = require('plist');
var sharp = require('sharp');
var stdio = require('stdio');
var xcode = require('xcode');
var sync = require('sync');
var deasync = require('deasync');
var imageSize = require('image-size');
var md5 = require('md5');
var util = require('./util.js');
const environment = require('./environment.json');
const readlineSync = require('readline-sync');


var ops = stdio.getopt({
    // 'appconfig': {key: 'c', args: 1, mandatory: true, description: 'Full path to config file'},
    // 'php': {key: 'p', args: 1, mandatory: true, description: 'Full path to PHP interpreter'},
    // 'node': {key: 'n', args: 1, mandatory: true, description: 'Full path to node interpreter'},
    // 'screengenerator': {key: 's', args: 1, mandatory: true, description: 'Full path to screengenerator'},
    'create':{description: "Create new project. --create <PROJECT_NAME> <URL_TO_GIT>(Optional)"},
    'update':{description: 'Pull latest changes for project'},
    'build':{description: 'Build app. Remove previous'},
    'manual':{description: 'Apply test manual changes'},
    'screenshots':{description: 'Make screenshots'},
    'framing':{description: 'Add frames to existing screenshots'},
    'beta':{args: 1, description: 'Distribute to beta. Available "fabric", "browserstack"'},
    'deploy':{description: 'Deploy release to Google Play/App Store'},
    'android':{description: 'Do action for android. If skip, will take platforms from config file'},
    'ios':{description: 'Do action for iOS. If skip, will take platforms from config file'},
    'download_bundle':{description: 'just download bundle'},
    'apk':{description: 'Operations only for apk'},

    'full_create': {description: 'Create app, Install plugins, Update bundle'},
    'update_plugin': {description: 'Install/Update Plugins, Update bundle'},
    'update_bundle': {description: 'Update bundle'},
    'translate_metadata': {description: 'Translate metadata from en local'},
    'capture_screenshots': {description: 'Capture screenshots through fastlane'},
    'frame_screenshots': {description: 'Frame screenshots'},
    'frame_output': { args: 1, description: 'Output path for'},
});

let appConfig = undefined;
var platforms = {};
var phpInterpreter = undefined;
var nodeInterpreter = undefined;
var screengenerator = undefined;
var androidSDKPath = undefined;
var frame_output = undefined;

main().then(result => {
    console.log("Finish generate project");
});

async function main() {
    //OLD
    var FULL_CREATE = false;
    var UPDATE_PLUGIN = false;
    var UPDATE_BUNDLE = false;
    var TRANSLATE_METADATA = false;
    var CAPTURE_SCREENSHOTS = false;
    var FRAME_SCREENSHOTS = false;
    var BUILD_AFTER = true
    var ANDROID = false;
    var IOS = false;
    var APK = false;


    //NEW
    let CREATE = false; // name & git_url
    let UPDATE = false;



    phpInterpreter = environment["php"];
    nodeInterpreter = environment["node"];
    screengenerator = environment["screengenerator"];
    androidSDKPath = environment["android_sdk_path"];


    CREATE = ops.create;
    UPDATE = ops.update;
    BUILD = ops.build;
    MANUAL = ops.manual;
    SCREENSHOTS = ops.screenshots;
    FRAMING = ops.framing;
    BETA = ops.beta;
    DEPLOY = ops.deploy;
    ANDROID = ops.android;
    IOS = ops.ios;
    DOWNLOAD_BUNDLE = ops.download_bundle
    APK = ops.apk;




    
    // if (ops.appconfig) {
        FULL_CREATE = ops.full_create;
        UPDATE_PLUGIN = ops.update_plugin;
        UPDATE_BUNDLE = ops.update_bundle;
        TRANSLATE_METADATA = ops.translate_metadata;
        CAPTURE_SCREENSHOTS = ops.capture_screenshots;
        FRAME_SCREENSHOTS = ops.frame_screenshots;
        frame_output = ops.frame_output;
    // }
    console.log(ops);

    const PWD = process.env.PWD;
    console.log(PWD)
    const MARKER_FILE_NAME=".qbix_cordova_installer";
    const CONFIG_FILE_NAME="config.json";

    const configPath = path.join(PWD, CONFIG_FILE_NAME);
    const buildPath = path.join(PWD, "build");


    if(CREATE) {
        const folderName = ops.args[0];
        // Create folder
        const folderPath = path.join(PWD, folderName);
        const markerFilePath = path.join(folderPath, MARKER_FILE_NAME);
        if (fs.existsSync(markerFilePath)) {
            console.error("Project already created. Please remove it or create in another folder");
            return;
        }
        createFolderIfNotExist(folderPath);


        const gitUrl = ops.args[1];
        if(gitUrl != null) {
            // Download here from github
            shell.exec("git clone " + gitUrl + " " + folderPath);
        }

        // Create marker file
        fs.writeFileSync(markerFilePath, "");
        return;
    }


    appConfig = require(configPath);
    if(ANDROID || IOS) {
        appConfig.platforms = [];
        if(ANDROID){
            appConfig.platforms.push("android");
        }
        if(IOS) {
            appConfig.platforms.push("ios");
        }
    }
    const appNameForOS = appConfig.name.split(" ").join('')

    // Prepare platforms
    const appRootPath = path.dirname(configPath)
    const appBuildRootPath = path.join(appRootPath, "build")
    for (platform in appConfig.platforms) {
        var platformAppDirectory = path.join(appBuildRootPath, appConfig.platforms[platform]);
        platforms[appConfig.platforms[platform]] = path.join(platformAppDirectory, appNameForOS)
    }

    if(UPDATE || BUILD) {
        const markerFilePath = path.join(PWD, MARKER_FILE_NAME);
        if (!fs.existsSync(markerFilePath)) {
            console.error("Not found project in current folder: " + PWD);
            return;
        }
    }

    if(UPDATE) {
        shell.exec("git pull origin master");
    }

    if(DOWNLOAD_BUNDLE) {
        createBundle(appConfig, platforms);
    }

    if(BUILD) {
        if (!fs.existsSync(configPath)) {
            console.error("Not found config.json in current folder: " + PWD);
            return;
        }
       
        createFolderIfNotExist(appBuildRootPath);

        // Create separate project for each platform
        for (platform in appConfig.platforms) {
            const platformName = appConfig.platforms[platform];
            const buildPathForPlatform = path.join(buildPath, platformName);
            if(fs.existsSync(buildPathForPlatform)) {
                if (!readlineSync.keyInYN('Previous '+platformName+' build will be removed. Continue?')) {
                    return ;
                }
                await util.File.rmDir(buildPathForPlatform);
            }

            console.log("BUILD");
            var platformAppDirectory = path.join(appBuildRootPath, appConfig.platforms[platform]);
            console.log(platformAppDirectory);
            createFolderIfNotExist(platformAppDirectory);
            platforms[appConfig.platforms[platform]] = path.join(platformAppDirectory, appNameForOS)
        }

        // Add projects
        console.log(appNameForOS);
        addProjects(appNameForOS)

        // setupConfig
        setupConfig(appConfig);

        // Copy icons
        await copyIcons(appConfig,platforms, appRootPath);

        // Add platforms
        addPlatforms(androidSDKPath);

        // Copy resourcpyResources(appConfig, appRootPath, platforms)
        copyResources(appConfig, appRootPath, platforms)

        if(appConfig.splashscreen != undefined && appConfig.splashscreen.generate) {
            // Generate splashscreen
            await generateSplashscreens(appConfig, appRootPath);
        } else {
            // Copy splashscreen
            copyIOSSplashscreens();
        }

        addPlugins();
    }

    if(BUILD || UPDATE) {

        //update metadata
        console.log("---updateMetadata---");
        updateMetadata(appConfig, platforms);
        // create bundle
        console.log("---createBundle---");
        createBundle(appConfig, platforms)
        //create config.json file for main Q plugin
        console.log("---copyQConfig---");
        copyQConfig(appConfig, platforms);
        // Create deploy config
        console.log("---createDeployConfig---");
        await createDeployConfig(appConfig, platforms, appRootPath);

    }

    if(BUILD) {
        console.log("---performManulaChanges---");
        performManulaChanges(appConfig, platforms)
    }

    if(BUILD || UPDATE) {
        console.log("---cordovaBuild---");
        cordovaBuild(BUILD_AFTER,platforms)
    }

    if(MANUAL) {
        await testPerformManulaChanges(appConfig, platforms)
    }

    if(SCREENSHOTS) {
        console.log("---captureScreenshots---");
        await captureScreenshots(appConfig, platforms);
        console.log("---After captureScreenshots---");
    }

    if(FRAMING) {
        console.log("---frameScreenshots---");
        frameScreenshots(appConfig, platforms);
    }

    if(BETA) {
        console.log("---distributeBeta---");
        distributeBeta(appConfig, platforms, APK);
    }

    if(DEPLOY) {
        console.log("---deploy---");
        deploy(appConfig, platforms);
    }

    return;

    if (FULL_CREATE) {
    // Add projects
        console.log(appNameForOS);
        addProjects(appNameForOS)

    // setupConfig
        setupConfig(appConfig);

    // Copy icons
        await copyIcons(appConfig,platforms, appRootPath);

    // Add platforms
        addPlatforms();

    // Copy resourcpyResources(appConfig, appRootPath, platforms)
        copyResources(appConfig, appRootPath, platforms)

        if(appConfig.splashscreen != undefined && appConfig.splashscreen.generate) {
            // Generate splashscreen
            await generateSplashscreens(appConfig, appRootPath);
        } else {
            // Copy splashscreen
            copyIOSSplashscreens();
        }
    }

    if (FULL_CREATE || UPDATE_PLUGIN) {
// Added plugins
// Please not if plugin has string variables you have to wrap it like "/"Some big string/""
//         removePlugins(["com.q.users.cordova"]);
        addPlugins();

    }
    if (FULL_CREATE || UPDATE_PLUGIN || UPDATE_BUNDLE) {
        //update metadata
        console.log("---updateMetadata---");
        updateMetadata(appConfig, platforms);
        //create bundle
        console.log("---createBundle---");
        createBundle(appConfig, platforms)
        //create config.json file for main Q plugin
        console.log("---copyQConfig---");
        copyQConfig(appConfig, platforms);
        // Create deploy config
        console.log("---createDeployConfig---");
        await createDeployConfig(appConfig, platforms, appRootPath);
    }

    // cordovaBuild(BUILD_AFTER,platforms)

    if (FULL_CREATE) {
        console.log("---performManulaChanges---");
        performManulaChanges(appConfig, platforms)
        console.log("---cordovaBuild---");
        cordovaBuild(BUILD_AFTER,platforms)
    }

    if (FULL_CREATE || UPDATE_PLUGIN || UPDATE_BUNDLE) {
        // Update name of app
        console.log("---updateNameOfApp---");
        // updateNameOfApp(appConfig, platforms)
    }

    if(TRANSLATE_METADATA) {
        console.log("---translateMetadata---");
        translateMetadata(appConfig, platforms);
    }

    if(CAPTURE_SCREENSHOTS) {
        console.log("---captureScreenshots---");
        await captureScreenshots(appConfig, platforms);
        console.log("---frameScreenshots---");
        frameScreenshots(appConfig, platforms);
    }

    if(FRAME_SCREENSHOTS) {
        console.log("---frameScreenshots---");
        frameFileScreenshots(appConfig, platforms);
    }

    performManulaChanges(appConfig, platforms)
    cordovaBuild(BUILD_AFTER,platforms)
}

async function deploy(appConfig, platforms) {
    console.log(platforms)
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var projectPath = path.join(pathFolder, "platforms", platform)

        let command = "cd " + projectPath + " && fastlane release_no_screenshot";
        if(platform == "ios") {
            execWithLog("export FASTLANE_USER=\""+appConfig["signing"]["ios"]["appleId"]+"\"");
            execWithLog("export FASTLANE_PASSWORD=\""+appConfig["signing"]["ios"]["applePassword"]+"\"");
            // command = "export FASTLANE_USER="+appConfig["signing"]["ios"]["appleId"]+" && export FASTLANE_PASSWORD="+appConfig["signing"]["ios"]["applePassword"]+ " && "+command;
        }
        execWithLog(command);
    }
}

async function distributeBeta(appConfig, platforms, apk) {
    console.log(platforms)
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var projectPath = path.join(pathFolder, "platforms", platform)

        console.log(projectPath);
        execWithLog("cd " + pathFolder + " &&  cordova build "+platform);
        
        let action = null;
        if(BETA == "fabric") {
            action= "upload_to_crashlytics"
        } else if(BETA == "browserstack") {
            // execWithLog("cd " + projectPath + " && fastlane add_plugin browserstack");
            action= "upload_to_browserstack"
        } else if(BETA == "firebase") {
            console.log("Should run using root");
            // execWithLog("cd " + projectPath + " && fastlane add_plugin firebase_app_distribution");
            if(platform == "android") {
                if(apk) {
                    execWithLog("cd " + projectPath + " && fastlane build_debug_apk");
                    execWithLog("cd " + projectPath + " && fastlane upload_to_firebase_apk");
                } else {
                    execWithLog("cd " + projectPath + " && fastlane build_debug");
                    execWithLog("cd " + projectPath + " && fastlane upload_to_firebase");
                }
            } else {
                execWithLog("cd " + projectPath + " && fastlane build_debug_development");
                execWithLog("cd " + projectPath + " && fastlane upload_to_firebase");
            }
            continue;
        }
        if(action != null) {
            execWithLog("cd " + projectPath + " && fastlane "+action);
        }
    }
}

function cordovaBuild(BUILD_AFTER,platforms) {
    if(BUILD_AFTER) {
        for(platform in platforms) {
            shell.cd(platforms[platform]);
            execWithLog('cordova build ' + platform);
            if(platform == "ios") {
                console.log("---final pod install---");
                let pathFolder = path.join(platforms[platform]);
                execWithLog("cd "+path.join(pathFolder, "platforms", platform)+" && pod install");
            } else {
                let pathFolder = path.join(platforms[platform]);
                execWithLog("cd "+path.join(pathFolder, "platforms", platform)+" && chmod a+x gradlew");
            }
        }
    }
}

function execWithLog(command) {
    console.log("Running "+command);
    console.log(shell.exec(command).stdout);
}

function writeXmlFile(xmlPath, parsedConfigFile) {
    var parser = new xml2js.Parser(), xmlBuilder = new xml2js.Builder();
    var xml = xmlBuilder.buildObject(parsedConfigFile);
    fs.writeFileSync(xmlPath, xml)
}

function readXmlFile(xmlPath) {
    var parser = new xml2js.Parser(), xmlBuilder = new xml2js.Builder();

    var globalResult = null
    var content = fs.readFileSync(xmlPath);
    parser.parseString(content, function (err, result) {
        globalResult =  result;
    });

    return globalResult
}

function addProjects(appNameForOS) {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        if (!fs.existsSync(pathFolder)) {
            execWithLog('cordova create ' + pathFolder + " " + appConfig.packageId[platform] + " " + appNameForOS);
        }
    }
}

function addPlatforms(addPlatforms) {
    for(platform in platforms) {
        shell.cd(platforms[platform]);
        shell.exec('cordova platform add ' + platform).output;
        if(platform == "android") {
            var localProperties = path.join(platforms[platform], "platforms","android", "local.properties");
            console.log("Local properties: "+localProperties);
            fs.appendFileSync(localProperties, "sdk.dir="+androidSDKPath);
        }
    }
}

function removePlugins(removePlugins) {
    for(plugin in removePlugins) {
        for(platform in platforms) {
            var pathToApp = platforms[platform]
            shell.cd(pathToApp);
            command = generatePluginRemoveCL(removePlugins[plugin], pathToApp)
            shell.exec(command);
        }
    }
}

function addPlugins() {
    console.log("Add plugins")
    for(plugin in appConfig.plugins) {
        var pluginConfig = appConfig.plugins[plugin]

        for (platformIndex in pluginConfig.platforms) {
            var pathToApp = platforms[pluginConfig.platforms[platformIndex]];
            if(pathToApp == undefined)
                continue;

            var pluginOption = appConfig.plugins[plugin];
            shell.cd(pathToApp);
            console.log("Plugin "+plugin);
            command = generatePluginInstallCL(plugin, pluginOption, pathToApp)
            shell.exec(command).stdout;

            var platform = [pluginConfig.platforms[platformIndex]]
            if(pluginOption.patch != undefined) {
                for(file in pluginOption.patch[platform]) {
                    var patchObject = pluginOption.patch[platform][file];

                    for(filePath in patchObject.path) {
                        var pathToFileChange = path.join(pathToApp,patchObject.path[filePath]);

                        var content = fs.readFileSync(pathToFileChange, "utf-8");
                        content = content.replace(patchObject.find,patchObject.replace);
                        fs.writeFileSync(pathToFileChange, content)
                    }

                }
            }
        }
        printCocoaPods()
    }
    console.log("Apply patch")
    for(platform in platforms) {
        const pathToApp = platforms[platform];

        if(appConfig.patch != undefined && appConfig.patch[platform] != undefined) {
            for(file in appConfig.patch[platform]) {
                var patchObject = appConfig.patch[platform][file];
                for(filePath in patchObject.path) {
                    try {
                        var pathToFileChange = path.join(pathToApp,patchObject.path[filePath]);
                        var content = fs.readFileSync(pathToFileChange, "utf-8");
                        content = content.replace(patchObject.find,patchObject.replace);
                        fs.writeFileSync(pathToFileChange, content)
                    } catch(e) {
                        console.error(e);
                    }
                }
            }
        }
        printCocoaPods()
    }
}

function printCocoaPods() {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        if(platform == "ios") {
            // // Add legacy build mode
            var podfilePath = path.join(pathFolder, "platforms", "ios", "Podfile");
            var content = fs.readFileSync(podfilePath, "utf8");
            console.log(content);
        }
    }
}

function setupConfig(appConfig) {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var config = readXmlFile(path.join(pathFolder, "config.xml"))

        // Setup name
        // config.widget.name[0] = appConfig.name

        if(platform == "android") {
            var platformConfig = config.widget.platform[0]

            // Setup allow-navigation
            platformConfig["allow-navigation"] = [{$: {href: "https:*"}}, {$: {href: "http:*"}}]

            if(appConfig.AndroidPreferences !== undefined) {
                platformConfig["preference"] = [];
                for (key in appConfig.AndroidPreferences) {
                    platformConfig["preference"].push({$:{ name:key, value:appConfig.AndroidPreferences[key]}})
                }
            }
            config.widget.platform[0] = platformConfig
        } else {
            var platformConfig = config.widget.platform[1]

            // Setup allow-navigation
            platformConfig["allow-navigation"] = [{$: {href: "https:*"}}, {$: {href: "http:*"}}]

            // Setup permission usage description for ios
            if(appConfig.iOSParametersInfoPlist !== undefined) {
                platformConfig["edit-config"] = []
            }
            for (key in appConfig.iOSParametersInfoPlist) {
                platformConfig["edit-config"].push({$:{ target:key, file:"*-Info.plist", mode:"merge"}, string: [appConfig.iOSParametersInfoPlist[key]]})
            }

            if(appConfig.iOSPreferences !== undefined) {
                platformConfig["preference"] = [];
                for (key in appConfig.iOSPreferences) {
                    platformConfig["preference"].push({$:{ name:key, value:appConfig.iOSPreferences[key]}})
                }
            }
            // console.log(platformConfig["edit-config"])
            config.widget.platform[1] = platformConfig
        }

        writeXmlFile(path.join(pathFolder, "config.xml"), config);
    }
}

function updateMetadata(appConfig, platforms) {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var config = readXmlFile(path.join(pathFolder, "config.xml"))
        
        config.widget['$'].version = appConfig.versions[platform].version
        if(platform == "android") {
            config.widget['$']["android-versionCode"] = appConfig.versions[platform].code;
        } else {
            config.widget['$']["ios-CFBundleVersion"] = appConfig.versions[platform].code;
        }

        var aNavigationUrlSchema = appConfig.openUrlScheme+":*";
        if(config.widget['allow-navigation'] != undefined) {
            var isFind = false;
            for(index in config.widget['allow-navigation']) {
                if(config.widget['allow-navigation'][index]['$'].href == aNavigationUrlSchema) {
                    isFind = true;
                    break;
                }
            }

            if(!isFind) {
                config.widget['allow-navigation'].push({'$': {href: aNavigationUrlSchema}});
            }
        } else {
            config.widget['allow-navigation'] = [
                {'$': {href: aNavigationUrlSchema}}
            ]
        }

        writeXmlFile(path.join(pathFolder, "config.xml"), config);
    }
}

async function createDeployConfig(appConfig, platforms, appRootPath) {
    console.log("createDeployConfig")
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform], "platforms",platform)
        console.log(pathFolder);
        console.log("___");
        var fastlanePath = path.join(pathFolder, "fastlane");

        createFolderIfNotExist(fastlanePath)

        shell.cd(fastlanePath);

        var androidScreengrabScreenshots = "urls ";
        var iosScreenshots = "";
        if(appConfig.deploy.screenshots != undefined) {
            appConfig.deploy.screenshots.forEach(function(screen) {
                if(iosScreenshots.length > 0) {
                    androidScreengrabScreenshots += ","
                    iosScreenshots += "|"
                } else {
                    iosScreenshots = "\"-init_url "
                }
                androidScreengrabScreenshots += screen.url
                iosScreenshots += screen.url
            });
        }
        iosScreenshots += "\""
        var languages = "";
        // var locales = util.Local.getArrayLocale(util.Local.getLocales(appConfig.deploy.locales));
        var locales = util.Local.getArrayLocale(appConfig.deploy.locales);
        for(index in locales) {
            languages += "\""+locales[index]+"\",";
        }

        if(platform == "android") {
            var fastlaneExamplePath = path.join(__dirname, "fastlane_templates", "android");

            //Create release config
            var signingContent = "storeFile=../../../../../"+appConfig.signing.android.storeFile+"\n"+
                            "storePassword="+appConfig.signing.android.storePassword+"\n"+
                            "keyAlias="+appConfig.signing.android.keyAlias+"\n"+
                            "keyPassword="+appConfig.signing.android.keyPassword+"\n";
            fs.writeFileSync(path.join(pathFolder, "release-signing.properties"), signingContent)

            //Copy Appfile
            var appfileContent = fs.readFileSync(path.join(fastlaneExamplePath, "Appfile"), "utf-8");
            appfileContent = appfileContent.replace("<package_id>","\""+appConfig.packageId[platform]+"\"");
            fs.writeFileSync(path.join(fastlanePath, "Appfile"), appfileContent)
            //Copy Fastfile
            var fastfileContent = fs.readFileSync(path.join(fastlaneExamplePath, "Fastfile"), "utf-8");
            fastfileContent = fastfileContent.replace("<languages>",languages);
            fastfileContent = fastfileContent.replace("<screenshots_array>","\""+androidScreengrabScreenshots+"\"");

            if(appConfig.development.fabric != undefined) {
                fastfileContent = fastfileContent.replace(/#upload_to_crashlytics/g, "upload_to_crashlytics");
                var crashlyticsFunction = "desc \"Upload to Crashlytics\"\n \
                        lane :upload_to_crashlytics do\n \
                        gradle(task: \"clean assembleDebug\")\n \
                        crashlytics(\n \
                            emails: \""+appConfig.development.fabric.testers+"\",\n \
                            api_token: \""+appConfig.development.fabric.fabric_api_key+"\",\n \
                            build_secret: \""+appConfig.development.fabric.fabric_api_secret+"\"\n \
                        )\n \
                    end\n"
                fastfileContent=fastfileContent.replace(/#function_upload_to_crashlytics/g,crashlyticsFunction);
            }

            if(appConfig.development.browserstack != undefined) {
                fastfileContent = fastfileContent.replace(/#upload_to_browserstack/g, "upload_to_browserstack");
                var browserstackFunction = "desc \"Upload to Browserstack\"\n \
                        lane :upload_to_browserstack do\n \
                        gradle(task: \"clean assembleDebug\")\n \
                        upload_to_browserstack_app_live(\n \
                            browserstack_username: \""+appConfig.development.browserstack.username+"\",\n \
                            browserstack_access_key: \""+appConfig.development.browserstack.access_key+"\",\n \
                        )\n \
                    end\n"
                fastfileContent=fastfileContent.replace(/#function_upload_to_browserstack/g,browserstackFunction);
            }

            const googleServicePath = path.join(pathFolder, "app", "google-services.json");
            console.log(googleServicePath);
            if(fs.existsSync(googleServicePath)) {
                const googleServiceContent = require(googleServicePath);
                const appId = googleServiceContent["client"][0]["client_info"]["mobilesdk_app_id"];

                fastfileContent = fastfileContent.replace(/#upload_to_firebase/g, "upload_to_firebase");
                var firebseFunction = "desc \"Upload to Firebase\"\n \
                        lane :upload_to_firebase do\n \
                        firebase_app_distribution(\n \
                            app: \""+appId+"\",\n \
                            apk_path: \"app/build/outputs/bundle/debug/app.aab\",\n \
                            testers: \""+appConfig.development.firebase.testers+"\",\n \
                        )\n \
                    end\n"
                firebseFunction += "desc \"Upload to Firebase Alpha\"\n \
                        lane :upload_to_firebase_alpha do\n \
                        build\n \
                        firebase_app_distribution(\n \
                            app: \""+appId+"\",\n \
                            apk_path: \"app/build/outputs/bundle/release/app.aab\",\n \
                            testers: \""+appConfig.development.firebase.testers+"\",\n \
                        )\n \
                    end\n"    
                firebseFunction += "desc \"Upload to Firebase\"\n \
                        lane :upload_to_firebase_apk do\n \
                        firebase_app_distribution(\n \
                            app: \""+appId+"\",\n \
                            apk_path: \"app/build/outputs/apk/debug/app-debug.apk\",\n \
                            testers: \""+appConfig.development.firebase.testers+"\",\n \
                        )\n \
                    end\n"
                firebseFunction += "desc \"Upload to Firebase Alpha\"\n \
                        lane :upload_to_firebase_alpha_apk do\n \
                        build\n \
                        firebase_app_distribution(\n \
                            app: \""+appId+"\",\n \
                            apk_path: \"app/build/outputs/apk/release/app-release.apk\",\n \
                            testers: \""+appConfig.development.firebase.testers+"\",\n \
                        )\n \
                    end\n"         
                fastfileContent=fastfileContent.replace(/#function_upload_to_firebase/g,firebseFunction);
            }

            



            // var googleServicePath = path.join(pathFolder, "platforms", "ios","GoogleService-Info.plist");

            // fastfileContent = fastfileContent.replace(/<testers>/g, appConfig.development.fabric.testers);
            // fastfileContent = fastfileContent.replace(/<fabric_api_key>/g, appConfig.development.fabric.fabric_api_key);
            // fastfileContent = fastfileContent.replace(/<fabric_api_secret>/g, appConfig.development.fabric.fabric_api_secret);
            
            fs.writeFileSync(path.join(fastlanePath, "Fastfile"), fastfileContent)
            
            //Copy Screengrabline
            // var screengrablineContent = fs.readFileSync(path.join(fastlaneExamplePath, "Screengrabline"), "utf-8");
            // screengrablineContent = screengrablineContent.replace("<screenshots_string>","\""+androidScreengrabScreenshots+"\"")
            // screengrablineContent = screengrablineContent.replace("<languages>",languages);
            // fs.writeFileSync(path.join(fastlanePath, "Screengrabline"), screengrablineContent)


            // Setup metadata
            var fastlaneMetadataPath = path.join(fastlanePath, "metadata");
            createFolderIfNotExist(fastlaneMetadataPath)
            var fastlaneMetadataAndroidPath = path.join(fastlaneMetadataPath, "android");
            createFolderIfNotExist(fastlaneMetadataAndroidPath)
            var fastlaneMetadataAndroidEnPath = path.join(fastlaneMetadataAndroidPath, "en-US");
            createFolderIfNotExist(fastlaneMetadataAndroidEnPath)
            var fastlaneMetadataAndroidChangelogsPath = path.join(fastlaneMetadataAndroidEnPath, "changelogs");
            createFolderIfNotExist(fastlaneMetadataAndroidChangelogsPath)

            fs.writeFileSync(path.join(fastlaneMetadataAndroidEnPath, "title.txt"), appConfig.displayName);
            fs.writeFileSync(path.join(fastlaneMetadataAndroidEnPath, "short_description.txt"), appConfig.deploy.shortDescription);
            fs.writeFileSync(path.join(fastlaneMetadataAndroidEnPath, "full_description.txt"), appConfig.deploy.description);
            fs.writeFileSync(path.join(fastlaneMetadataAndroidChangelogsPath, appConfig.versions.android.code+".txt"), appConfig.deploy.release_notes);
            
            // Setup icon and Google Play feature
            var fastlaneMetadataAndroidImages = path.join(fastlaneMetadataAndroidEnPath, "images");
            createFolderIfNotExist(fastlaneMetadataAndroidImages);
            //copy icon icon.png 512 x 512 32-bit PNG
            var originalIconPath = path.join(appRootPath, "icon.png")
            var promise = sharp(originalIconPath).resize(512, 512).toFile(path.join(fastlaneMetadataAndroidImages, "icon.png"))
            await promise;
            // Copy Google Play feature featureGraphic.png 1024 w x 500 h JPG 
            await createImageWithCenterIcon(1024, 500, appConfig.background, "jpeg", originalIconPath, path.join(fastlaneMetadataAndroidImages, "featureGraphic.jpeg"));
        } else {
            var fastlaneExamplePath = path.join(__dirname, "fastlane_templates", "ios");
            //Copy Appfile
            var appfileContent = fs.readFileSync(path.join(fastlaneExamplePath, "Appfile"), "utf-8");
            appfileContent = appfileContent.replace("<app_identifier>",appConfig.packageId[platform]);
            appfileContent = appfileContent.replace("<apple_id>",appConfig.signing[platform].appleId);
            appfileContent = appfileContent.replace("<itc_team_name>",appConfig.signing[platform].itc_team_name);
            fs.writeFileSync(path.join(fastlanePath, "Appfile"), appfileContent)
            //Copy Fastfile
            var fastfileContent = fs.readFileSync(path.join(fastlaneExamplePath, "Fastfile"), "utf-8");
            fastfileContent = fastfileContent.replace(/<project_name>/g, appConfig.name);
            fastfileContent = fastfileContent.replace(/<team_id>/g, appConfig.signing.ios.team_id);

            if(appConfig.development.fabric != undefined) {
                fastfileContent = fastfileContent.replace(/#upload_to_crashlytics/g, "upload_to_crashlytics");
                var crashlyticsFunction = "desc \"Upload to Crashlytics\"\n \
                        lane :upload_to_crashlytics do\n \
                        build_debug\n \
                        crashlytics(\n \
                            emails: \""+appConfig.development.fabric.testers+"\",\n \
                            api_token: \""+appConfig.development.fabric.fabric_api_key+"\",\n \
                            build_secret: \""+appConfig.development.fabric.fabric_api_secret+"\"\n \
                        )\n \
                    end\n"
                fastfileContent = fastfileContent.replace(/#function_upload_to_crashlytics/g,crashlyticsFunction);
            }

            if(appConfig.development.browserstack != undefined) {
                fastfileContent = fastfileContent.replace(/#upload_to_browserstack/g, "upload_to_browserstack");
                var browserstackFunction = "desc \"Upload to Browserstack\"\n \
                        lane :upload_to_browserstack do\n \
                        automatic_code_signing\n \
                        upload_to_browserstack_app_live(\n \
                            browserstack_username: \""+appConfig.development.browserstack.username+"\",\n \
                            browserstack_access_key: \""+appConfig.development.browserstack.access_key+"\",\n \
                        )\n \
                    end\n";
                fastfileContent = fastfileContent.replace(/#function_upload_to_browserstack/g,browserstackFunction);
            }

            const googleServicePath = path.join(pathFolder, "GoogleService-Info.plist");
            console.log(googleServicePath);
            if(fs.existsSync(googleServicePath)) {
                var googleServiceContent = fs.readFileSync(googleServicePath, "utf-8");
                var plistParsed = plist.parse(googleServiceContent);
                const appId = plistParsed.GOOGLE_APP_ID;

                fastfileContent = fastfileContent.replace(/#upload_to_firebase/g, "upload_to_firebase");
                var firebseFunction = "desc \"Upload to Firebase\"\n \
                        lane :upload_to_firebase do\n \
                        firebase_app_distribution(\n \
                            app: \""+appId+"\",\n \
                            testers: \""+appConfig.development.firebase.testers+"\",\n \
                        )\n \
                    end\n"
                fastfileContent=fastfileContent.replace(/#function_upload_to_firebase/g,firebseFunction);
            }

            fs.writeFileSync(path.join(fastlanePath, "Fastfile"), fastfileContent)
            //Copy Snapfile
            var snapfileContent = fs.readFileSync(path.join(fastlaneExamplePath, "Snapfile"), "utf-8");
            snapfileContent = snapfileContent.replace(/<project_name>/g, appConfig.name);
            snapfileContent = snapfileContent.replace("<screenshots>", iosScreenshots);
            
            
            snapfileContent = snapfileContent.replace("<languages>", languages);
            fs.writeFileSync(path.join(fastlanePath, "Snapfile"), snapfileContent)

            // Setup metadata
            var fastlaneMetadataPath = path.join(fastlanePath, "metadata");
            createFolderIfNotExist(fastlaneMetadataPath)
            var fastlaneMetadataEnPath = path.join(fastlaneMetadataPath, "en-US");
            createFolderIfNotExist(fastlaneMetadataEnPath)

            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "name.txt"), appConfig.displayName);
            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "promotional_text.txt"), appConfig.deploy.shortDescription);
            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "description.txt"), appConfig.deploy.description);
            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "keywords.txt"), appConfig.deploy.keywords);
            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "privacy_url.txt"), appConfig.deploy.privacy_url);
            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "support_url.txt"), appConfig.deploy.support_url);
            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "subtitle.txt"), appConfig.deploy.subtitle);
            fs.writeFileSync(path.join(fastlaneMetadataEnPath, "release_notes.txt"), appConfig.deploy.release_notes);

            // Copy icons
            var originalIconPath = path.join(appRootPath, "icon.png")
            await sharp(originalIconPath).jpeg().resize(1024, 1024).toFile(path.join(fastlaneMetadataPath, "app_icon.jpeg"))

            fs.writeFileSync(path.join(fastlaneMetadataPath, "copyright.txt"), appConfig.deploy.copyright);
            var fastlaneMetadataReviewPath = path.join(fastlaneMetadataPath, "review_information");
            createFolderIfNotExist(fastlaneMetadataReviewPath)
            fs.writeFileSync(path.join(fastlaneMetadataReviewPath, "email_address.txt"), appConfig.deploy.review_info.email);
            fs.writeFileSync(path.join(fastlaneMetadataReviewPath, "first_name.txt"), appConfig.deploy.review_info.first);
            fs.writeFileSync(path.join(fastlaneMetadataReviewPath, "last_name.txt"), appConfig.deploy.review_info.last);
            fs.writeFileSync(path.join(fastlaneMetadataReviewPath, "phone_number.txt"), appConfig.deploy.review_info.phone);
        }
    }
}

function translateMetadata(appConfig, platforms) {
    var translatorPath = path.join(__dirname, "translator");
    var translatorScriptPath = path.join(translatorPath, "translator.js");

    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var sourceLanguage = "en-US";
        var metadataPath = "";
        if(platform == "android") {
            metadataPath = path.join(pathFolder, "platforms","android","fastlane","metadata","android")
        } else {
            metadataPath = path.join(pathFolder, "platforms","ios","fastlane","metadata")
        }

        var pathToEnglishMetadta = path.join(metadataPath, sourceLanguage);
        var ios_metadata_translations = [
            path.join(pathToEnglishMetadta, "description.txt"),
            path.join(pathToEnglishMetadta, "keywords.txt"),
            path.join(pathToEnglishMetadta, "promotional_text.txt"),
            path.join(pathToEnglishMetadta, "release_notes.txt"),
            path.join(pathToEnglishMetadta, "subtitle.txt"),
        ];
        var android_metadata_translations = [
            path.join(pathToEnglishMetadta, "full_description.txt"),
            path.join(pathToEnglishMetadta, "short_description.txt"),
        ];

        var locales = util.Local.getArrayLocale(util.Local.getLocales(appConfig.deploy.locales));

        var filesToTranslate = [];
        if(platform == "android") {
            filesToTranslate = android_metadata_translations;
        } else if(platform == "ios") {
            filesToTranslate = ios_metadata_translations;
        }

        for(index in filesToTranslate) {
            // Read file content
            var fileName =  filesToTranslate[index];
            fileName = fileName.split('/').pop()
            var pathToFile = path.join(metadataPath, sourceLanguage, fileName)
            var content = util.File.readFileSync(pathToFile);

            // Translate for each locale
            for(local in locales) {
                local = locales[local];
                var newContent = translateText(content, sourceLanguage, local);

                // Write to new file
                var finalOutputPath = path.join(metadataPath, local)
                if(!util.File.isExistPath(finalOutputPath)) {
                    util.File.mkDir(finalOutputPath)
                }
                var outputFile = path.join(finalOutputPath, fileName)
                util.File.writeFileSync(outputFile, newContent);
            }
        }

        // copy title
        var filesToCopy = [];
        var filenameOfTitle = "";
        if(platform == "android") {
            filenameOfTitle = "title.txt";
        } else if(platform == "ios") {
            filenameOfTitle = "name.txt";
        }
        for(local in locales) {
            local = locales[local];
            var finalOutputPath = path.join(metadataPath, local)
            var outputFile = path.join(finalOutputPath, filenameOfTitle)
            util.File.writeFileSync(outputFile, content);
        }

    }
}

async function captureScreenshots(appConfig, platforms) {
    console.log(platforms)
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var projectPath = path.join(pathFolder, "platforms", platform)

        console.log(projectPath)
        if(platform == "android") {
            var fastlanePath = path.join(projectPath, "fastlane", "metadata","android");

            var dirs = util.File.getDirs(fastlanePath);
            for(index in dirs) {
                var languaheDir = dirs[index];
                var phoneScreenshotsPath = path.join(fastlanePath, languaheDir, "images", "phoneScreenshots");
                util.File.rmDir(phoneScreenshotsPath);
            }

            //Remove all screenshots
            let screenshotsPathSource = path.join(projectPath, "fastlane", "metadata", "raw");
            fs_extra.emptyDirSync(screenshotsPathSource);

            // Run emulator for Android device
            // Android_screenshotgenerator_emulator
            let runEmulatorCommand = "emulator -avd AndroidScreenshotgeneratorEmulator";
            var emulatorRunning = shellEmulator.exec(runEmulatorCommand, {async:true, silent:true});
            console.log(runEmulatorCommand+"; Result: "+JSON.stringify(emulatorRunning));
            var command = "cd " + projectPath + " && fastlane "+platform+" screenshots";
            execWithLog(command);
            emulatorRunning.kill();
            console.log("After running android emulator");

            // Run emulator for Android Tablet
            // Android_tablet_screenshotgenerator_emulator
            runEmulatorCommand = "emulator -avd AndroidTabletScreenshotgeneratorEmulator";
            emulatorRunning = shellEmulator.exec(runEmulatorCommand, {async:true, silent:true})
            console.log(runEmulatorCommand+ "; Result:"+JSON.stringify(emulatorRunning));
            var command = "cd " + projectPath + " && fastlane "+platform+" screenshots";
            execWithLog(command);
            emulatorRunning.kill();
        } else {
            let screenshotsPathSource = path.join(projectPath, "fastlane", "screenshots","raw");
            fs_extra.emptyDirSync(screenshotsPathSource);

            var command = "cd " + projectPath + " && fastlane "+platform+" screenshots";
            execWithLog(command);
        }

        
        
        if(platform == "android") {

        } else {
            var convertationRules = {
                "2048x2730":"2048x2732",
                "1241x2688":"1242x2688"
            }
            var screenshotsPath = path.join(projectPath, "fastlane", "screenshots","raw");
            var filePromises = [];
            var filesToRemove = [];
            createFolderIfNotExist(screenshotsPath);
            var directories = getDirectories(screenshotsPath)
            for(directoryIndex in directories) {
                var directory = directories[directoryIndex];
                fs.readdirSync(directory).forEach(screenshot => {
                    if(screenshot !== ".DS_Store") {
                        var screenshotImagePath = path.join(directory, screenshot);
                        var dimensions = imageSize(screenshotImagePath);
                            
                        for(convertRule in convertationRules) {
                            var originalW = parseInt(convertRule.split("x")[0], 10);
                            var originalH = parseInt(convertRule.split("x")[1], 10);

                            var newW = parseInt(convertationRules[convertRule].split("x")[0], 10);
                            var newH = parseInt(convertationRules[convertRule].split("x")[1], 10);

                            if(dimensions.width == originalW && dimensions.height == originalH) {
                                finalScreenshotImagePath = screenshotImagePath;
                                finalScreenshotImagePath = finalScreenshotImagePath.replace(".png",".jpeg");
                                filePromises.push(sharp(screenshotImagePath).jpeg().resize(newW, newH).toFile(finalScreenshotImagePath));
                                filesToRemove.push(screenshotImagePath);
                            }
                        }
                    }
                });
            }
            await syncPromises(filePromises);

            for(file in filesToRemove) {
                fs.unlinkSync(filesToRemove[file])
            }
        }
    }
}

function frameFileScreenshots(appConfig, platforms) {
     var defaultLanguage = "en-US";
     for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var framesFolder = path.join(__dirname, "frame_template");

        var screenshotsPath = path.join(frame_output);

        var locales = util.Local.getArrayLocale(appConfig.deploy.locales);
        for(let index in locales) {
            var localBase = locales[index];
            for(let index in appConfig.deploy.screenshots) {
                var screenshotConfig = appConfig.deploy.screenshots[index];
                var file = screenshotConfig.file;
                var urlHash = md5(screenshotConfig.file)
                var frameIndex = index;
                console.log(screenshotConfig);
                console.log(localBase);
                var outputPath = path.join(screenshotsPath,localBase);

                frameScreenshot(file, outputPath, "iPhoneX", urlHash, screenshotConfig, framesFolder, defaultLanguage, localBase, frameIndex)   
            }
        }
    }

}

function frameScreenshots(appConfig, platforms) {
    var defaultLanguage = "en-US"
     for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var framesFolder = path.join(__dirname, "frame_template");

        var projectPath = path.join(pathFolder, "platforms", platform)
        var screenshotsPath = projectPath
        var screenshotsPathSource = projectPath
        if(platform == "android") {
            screenshotsPathSource = path.join(screenshotsPath, "fastlane", "metadata", "raw")
            screenshotsPath = path.join(screenshotsPath, "fastlane", "metadata", "android")
            fs_extra.emptyDirSync(screenshotsPath);
        } else {
            screenshotsPathSource = path.join(screenshotsPath, "fastlane", "screenshots", "raw")
            screenshotsPath = path.join(screenshotsPath, "fastlane", "screenshots")
        }

        var locals = getDirectoriesWithFiles(screenshotsPathSource);
        for(local in locals) {
            if(platform == "android") {
                var localBase = path.basename(local);
                var outputPath = path.join(screenshotsPath,localBase,"images");
                fs_extra.emptyDirSync(outputPath);
            }
        }
        console.log(locals);
        for(index in appConfig.deploy.screenshots) {
            var screenshotConfig = appConfig.deploy.screenshots[index];
            var urlHash = md5(screenshotConfig.url)
            console.log(screenshotConfig);
            var frameIndex = index;
            for(local in locals) {
                if(platform == "android") {
                    var matchedAndroidFiles = [];
                    var matchedAndroidTabletFiles = [];
                    var localBase = path.basename(local)
                    
                    var imagePath = path.join(screenshotsPathSource, localBase, "images", "phoneScreenshots");
                    var images = getFiles(imagePath);
                    for(index in images) {
                        var file = images[index];

                        // console.log(file);
                        var filename = path.basename(file)
                        if(filename.indexOf(urlHash) > -1 ) {
                            if(filename.indexOf("phone") > -1) {
                                matchedAndroidFiles.push(file);
                            } else if (filename.indexOf("tablet") > -1) {
                                matchedAndroidTabletFiles.push(file);
                            }
                        }
                    }
                    console.log(matchedAndroidFiles);
                    console.log(matchedAndroidTabletFiles);
                    
                    for(index in matchedAndroidFiles) {
                        var outputPath = path.join(screenshotsPath,localBase,"images","phoneScreenshots");
                        frameScreenshot(matchedAndroidFiles[0], outputPath, "Android", urlHash, screenshotConfig, framesFolder, defaultLanguage, localBase, frameIndex)
                    }
                    for(index in matchedAndroidTabletFiles) {
                        var outputPath = path.join(screenshotsPath,localBase,"images","sevenInchScreenshots");
                        frameScreenshot(matchedAndroidTabletFiles[0], outputPath, "AndroidTablet", urlHash, screenshotConfig, framesFolder, defaultLanguage, localBase, frameIndex)
                    }
                } else {
                    var matchedIPhoneFiles = [];
                    var matchedIPhoneXSFiles = [];
                    var matchedIPadFiles = [];
                    var files = locals[local];
                    var localBase = path.basename(local)
                    for(index in files) {
                        var file = files[index];
                        // console.log(file);

                        var filename = path.basename(file)
                        if(filename.indexOf(urlHash) > -1 ) {
                            if(filename.indexOf("iPhone 8 Plus") > -1) {
                                matchedIPhoneFiles.push(file);
                            } else if (filename.indexOf("iPhone XS Max") > -1) {
                                matchedIPhoneXSFiles.push(file);
                            } else if(filename.indexOf("iPad") > -1) {
                                matchedIPadFiles.push(file);
                            }
                        }
                    }

                    console.log(matchedIPhoneFiles);
                    console.log(matchedIPhoneXSFiles);
                    console.log(matchedIPadFiles);

                    var outputPath = path.join(screenshotsPath,localBase);

                    for(index in matchedIPhoneFiles) {
                        frameScreenshot(matchedIPhoneFiles[index], outputPath, "iPhone8", urlHash, screenshotConfig, framesFolder, defaultLanguage, localBase, frameIndex)
                    }
                    for(index in matchedIPhoneXSFiles) {
                        frameScreenshot(matchedIPhoneXSFiles[index], outputPath, "iPhoneX", urlHash, screenshotConfig, framesFolder, defaultLanguage, localBase, frameIndex)
                    }
                    for(index in matchedIPadFiles) {
                        frameScreenshot(matchedIPadFiles[index], outputPath, "iPad", urlHash, screenshotConfig, framesFolder, defaultLanguage, localBase, frameIndex)
                    }
                }
            }
        }
    }
}

function frameScreenshot(screenshot, pathOfScreenshot, devicePathName, urlHash, screenshotConfig, framesFolder,defaultLanguage, localBase, index) {
    
    var screenshot_ext = path.extname(screenshot);
    screenshot_ext = screenshot_ext.replace(".","");
    var template_image = screenshotConfig.frame.template_image;
    var template_config = screenshotConfig.frame.template_config;

    var replacedScreenshot = screenshot.replace(urlHash, (index+"_"+md5(urlHash)));
    var final_screenshot = path.join(pathOfScreenshot, path.basename(replacedScreenshot));


    if(screenshotConfig.frame.template_name != undefined) {
        var templatePath = path.join(framesFolder, screenshotConfig.frame.template_name);
        console.log(templatePath);
        if(util.File.isDir(templatePath)) {
            template_image = path.join(templatePath, devicePathName, "template.png");
            template_config = path.join(templatePath, devicePathName, "config.json");
        }
    }
    if(screenshot_ext == "jpeg") {
        screenshot_ext = "jpg";
        final_screenshot = final_screenshot.replace(".jpeg",".jpg");
    }

    var command = nodeInterpreter+" "+screengenerator
                    + " --template \""+template_image+"\""
                    + " --config \""+template_config+"\""
                    + " --backgroundColor \""+screenshotConfig.frame["background-color"]+"\"" 
                    + " --screenshot \""+screenshot+"\""
                    + " --output \""+final_screenshot+"\"";

    if(screenshotConfig.frame.text != undefined) {
        var finalText = [];

        for(index in screenshotConfig.frame.text) {
            var textBlock = screenshotConfig.frame.text[index];
            var translatedText = translateText(textBlock.text, defaultLanguage, localBase);
            finalText.push({
                text:translatedText,
                textColor:textBlock["text-color"]
            });
        }

        var jsonText = JSON.stringify(finalText).replace(/\"/g, '\\\"');
        command += " --text \""+jsonText+"\"";
    }

    // console.log(command);
    execWithLog(command);

    // Remove original file
    // fs.unlinkSync(screenshot)
}

function translateText(content, languageFrom, languageTo) {
    var translateQScriptPath = appConfig.deploy.translateQScript;
    // 0. Convert content to KV
    var file2json = {};
    var contentLines = content.split(/\r?\n/)
    for(var i = 0; i < contentLines.length;i++){
        file2json[i] = contentLines[i];
    }

    // 1. generating languageToFile
    var language_to_file_config = path.join(__dirname, "supported_locales.json");
    util.File.writeFileSync(language_to_file_config, JSON.stringify(util.Local.getLocaleFromArray([languageTo])));

    // 2. Write this file in temp source folder
    var tempSourceDir = path.join(__dirname, "tmp_translate_in");
    util.File.rmDir(tempSourceDir);
    util.File.mkDir(tempSourceDir);
    util.File.writeFileSync(path.join(tempSourceDir, languageFrom+".json"), JSON.stringify(file2json, null, 2));

    // 3. Create output folder
    var tempOutputDir = path.join(__dirname, "tmp_translate_output");
    util.File.rmDir(tempOutputDir);
    util.File.mkDir(tempOutputDir);

    // 4. run translate script
    var command = phpInterpreter+" " + translateQScriptPath 
    +" --source="+languageFrom
    +" --in="+tempSourceDir
    +" --out="+tempOutputDir
    +" --format=google --google-format=html"
    +" --locales="+language_to_file_config
    execWithLog(command);

    // 5. move translated data to fastlane
    var translatedText = "";
    fs.readdirSync(tempOutputDir).forEach(filename => {
        var lang = filename.split(".")[0];
        filepath = path.join(tempOutputDir, filename)
        var jsonArray = JSON.parse(util.File.readFileSync(filepath))
        translatedText = jsonArray.join('\n')
    });

    util.File.rmFile(language_to_file_config)

    util.File.rmDir(tempSourceDir);
    util.File.rmDir(tempOutputDir);
    return translatedText;
}

function updateNameOfApp(appConfig, platforms) {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])

        if(platform == "android") {
            var stringFilePath = path.join(pathFolder, "platforms", "android", "app", "src", "main", "res", "values", "strings.xml")
            var globalResult = readXmlFile(stringFilePath);
            for (item in globalResult.resources.string) {
                var itemContent = globalResult.resources.string[item];
                if(itemContent['$'].name == "app_name") {
                    itemContent['_'] = appConfig.displayName
                }
            }
            writeXmlFile(stringFilePath, globalResult);
        } else {
            var infoPlistFile = path.join(pathFolder, "platforms", "ios", appConfig.name, appConfig.name+"-Info.plist")
            var content = fs.readFileSync(infoPlistFile, "utf-8");
            var plistParsed = plist.parse(content);
            plistParsed.CFBundleDisplayName = appConfig.displayName;
            fs.writeFileSync(infoPlistFile, plist.build(plistParsed))
        }

    }
}


async function syncPromises(promisesArray) {
    return Promise.all(promisesArray)
}

async function copyIcons(appConfig, platforms, appRootPath) {
    var originalIconPath = path.join(appRootPath, "icon.png")

    var androidIconSize = {
        "ldpi.png":"36x36",
        "mdpi.png":"48x48",
        "hdpi.png":"72x72",
        "xhdpi.png":"96x96",
        "xxhdpi.png":"144x144",
        "xxxhdpi.png":"192x192"
    };
    var iosIcons = {
        "icon-60@3x.png":"180:180",
        "icon-60.png":"60:60",
        "icon-60@2x.png":"120:120",
        "icon-76.png":"76:76",
        "icon-76@2x.png":"152:152",
        "icon-40.png":"40:40",
        "icon-40@2x.png":"80:80",
        "icon-40@3x.png":"120:120",
        "icon.png":"57:57",
        "icon@2x.png":"114:114",
        "icon-72.png":"72:72",
        "icon-72@2x.png":"144:144",
        "icon-small.png":"29:29",
        "icon-small@2x.png":"58:58",
        "icon-small@3x.png":"87:87",
        "icon-50.png":"50:50",
        "icon-50@2x.png":"100:100",
        "icon-20.png":"20:20",
        "icon-20@2x.png":"40:40",
        "icon-20@3x.png":"60:60",
        "icon-83.5@2x.png":"167:167",
        "icon-1024.png":"1024:1024",
        "AppIcon24x24@2x.png":"48:48",
        "AppIcon27.5x27.5@2x.png":"55:55",
        "AppIcon86x86@2x.png":"172:172",
        "AppIcon98x98@2x.png":"196:196"
    };
    // var iosIcons = {
    //         "icon-60@3x.png":"180:180",
    //         "icon-60.png":"60:60",
    //         "icon-60@2x.png":"120:120",
    //         "icon-76.png":"76:76",
    //         "icon-76@2x.png":"152:152",
    //         "icon-40.png":"40:40",
    //         "icon-40@2x.png":"80:80",
    //         "icon-40@3x.png":"120:120",
    //         "icon.png":"57:57",
    //         "icon@2x.png":"114:114",
    //         "icon-72.png":"72:72",
    //         "icon-72@2x.png":"144:144",
    //         "icon-small.png":"29:29",
    //         "icon-small@2x.png":"58:58",
    //         "icon-small@3x.png":"87:87",
    //         "icon-50.png":"50:50",
    //         "icon-50@2x.png":"100:100",
    //         "icon-20.png":"20:20",
    //         "icon-20@2x.png":"40:40",
    //         "icon-20@3x.png":"60:60",
    //         "icon-83.5@2x.png":"167:167",
    //         "icon-1024.png":"1024:1024"
    // };

    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var pathToResource = path.join(pathFolder, "res")

        var platformPath = path.join(pathToResource, "icon", platform);

        util.File.rmDir(path.join(pathToResource, "icon"))
        util.File.mkDir(path.join(platformPath))

        var filePromises = [];
        if(platform == "android") {
            for(iconSize in androidIconSize) {
                var size = parseInt(androidIconSize[iconSize].split("x")[0], 10);
                var outputFile = path.join(platformPath, iconSize);
                var action = createImageWithFullsizeIcon(size, size, appConfig.background, "png", originalIconPath, outputFile);
                await action;
                // filePromises.push(sharp(originalIconPath).resize(size, size).toFile(path.join(platformPath, iconSize)));
            }
        } else {
            for(iconSize in iosIcons) {
                var size = parseInt(iosIcons[iconSize].split(":")[0], 10);
                var outputFile = path.join(platformPath, iconSize);
                if(size == 1024) {
                    // var noAlphaBackgroundColor = "#00"+appConfig.background.substring(1, appConfig.background.length);
                    // console.log(noAlphaBackgroundColor);
                    var action = createImageWithFullsizeIcon(size, size, appConfig.background, "jpeg", originalIconPath, outputFile);
                    await action;
                    // filePromises.push(action);
                    // filePromises.push(sharp(originalIconPath).resize(size, size).flatten().toFile(path.join(platformPath, iconSize)));
                } else {
                    // This approach show error that AppIcon83.5x83.5@2x~ipad not added to Archive bundle and you can't upload to AppStore
                    var action = createImageWithFullsizeIcon(size, size, appConfig.background, "png", originalIconPath, outputFile);
                    await action;
                    // filePromises.push(action);
                    // filePromises.push(sharp(originalIconPath).resize(size, size).toFile(path.join(platformPath, iconSize)));
                }
            }
        }

        await syncPromises(filePromises);

        util.File.rmDir(path.join(pathToResource, "screen"))
        copyRecursiveSync(path.join(appRootPath, "screen"), pathToResource)

        var config = readXmlFile(path.join(pathFolder, "config.xml"))
        // var icons = getAllFiles(path.join(appRootPath, "icon", platform))
        var icons = getAllFiles(platformPath)
        if(platform == "android") {
            // Icons
            var configAndroidIcons = [];
            for(iconIndex in icons) {
                filename = icons[iconIndex];
                var density = filename.replace(".png", "");
                if(density != undefined) {
                    configAndroidIcons.push({ '$': { src:path.join("res", "icon", "android", filename), density:density}})
                }
            }
            config.widget.platform[0].icon = configAndroidIcons

        } else {
            // Icons
            var configIOSIcons = [];
            for(iconIndex in icons) {
                filename = icons[iconIndex];
                if(iosIcons[filename] != undefined) {
                    var size = iosIcons[filename].split(":");
                    configIOSIcons.push({ '$': { src:path.join("res", "icon", "ios", filename), width:size[0], height:size[1]}})
                }
            }
            config.widget.platform[1].icon = configIOSIcons
        }
        writeXmlFile(path.join(pathFolder, "config.xml"), config);
    }
}

async function generateSplashscreens(appConfig, appRootPath) {
    console.log("Generate Splashscreens");
    var originalIconPath = path.join(appRootPath, "icon.png")

    var iosSplashscreens = {
        "Default-568h@2x~iphone.png":"640:1136",
        "Default-667h.png":"750:1334",
        "Default-736h.png":"1242:2208",
        "Default-2436h.png":"1125:2436",
        "Default@2x~iphone.png":"640:960",
        "Default~iphone.png":"320:480",
        "Default-Landscape-736h.png":"2208:1242",
        "Default-Landscape-2436h.png":"2436:1125",
        "Default-Landscape@2x~ipad.png":"2048:1536",
        "Default-Landscape~ipad.png":"1024:768",
        "Default-Portrait@2x~ipad.png":"1536:2048",
        "Default-Portrait~ipad.png":"768:1024"
    }

    var androidSplashscreens = {
        "drawable-land-hdpi":"800:480",
        "drawable-land-ldpi":"320:200",
        "drawable-land-mdpi":"480:320",
        "drawable-land-xhdpi":"1280:720",
        "drawable-land-xxhdpi":"1600:960",
        "drawable-land-xxxhdpi":"1920:1280",

        "drawable-port-hdpi":"480:800",
        "drawable-port-ldpi":"200:320",
        "drawable-port-mdpi":"320:480",
        "drawable-port-xhdpi":"720:1280",
        "drawable-port-xxhdpi":"960:1600",
        "drawable-port-xxxhdpi":"1280:1920",
    }

    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var sources = null;
        

        if(platform == "android") {
            sources = androidSplashscreens;
           // for (screenshot in androidSplashscreens) {
           //     var name = screenshot;
           //     var width = parseInt(androidSplashscreens[screenshot].split(":")[0], 10);
           //     var height = parseInt(androidSplashscreens[screenshot].split(":")[1], 10);
               
           //     var outputCordovaPath = path.join(pathFolder, "res", "screen", "android", name, ".png");
           //     var outputAndroidPath = path.join(pathFolder, "platforms", "android", appConfig.name.replace(/ /g, '\\ '), "app", "src", "main", "res", name, "screen.png");
                
           //     await createImageWithCenterIcon(width, height, appConfig.background, "png", originalIconPath, outputAndroidPath);

           //     outputFile = path.join(pathFolder, "platforms", "android", appConfig.name.replace(/ /g, '\\ '), "app", "src", "main", "res", name, "screen.png");
           // }
        } else {
            sources = iosSplashscreens;
           // for (screenshot in iosSplashscreens) {
           //     var name = screenshot;
           //     var width = parseInt(iosSplashscreens[screenshot].split(":")[0], 10);
           //     var height = parseInt(iosSplashscreens[screenshot].split(":")[1], 10);
               
           //     var outputCordovaPath = path.join(pathFolder, "res", "screen", "ios", name);
           //     var outputIOSPath = path.join(pathFolder, "platforms", "ios", appConfig.name.replace(/ /g, '\\ '), "Images.xcassets", "LaunchImage.launchimage", name);
                
           //     await createImageWithCenterIcon(width, height, appConfig.background, "png", originalIconPath, outputIOSPath);
               
           //     outputFile = 
           // }
        }

        for (screenshot in sources) {
               var name = screenshot;
               var width = parseInt(sources[screenshot].split(":")[0], 10);
               var height = parseInt(sources[screenshot].split(":")[1], 10);
               var outputFile = null;

               if(platform == "android") {
                    outputFile = path.join(pathFolder, "platforms", "android", "app", "src", "main", "res", name, "screen.png");
               } else {
                    outputFile = path.join(pathFolder, "platforms", "ios", appConfig.name.replace(/ /g, '\\ '), "Images.xcassets", "LaunchImage.launchimage", name);
               }
               
               // var outputCordovaPath = path.join(pathFolder, "res", "screen", "ios", name);
               // var outputIOSPath = path.join(pathFolder, "platforms", "ios", appConfig.name.replace(/ /g, '\\ '), "Images.xcassets", "LaunchImage.launchimage", name);
                
               await createImageWithCenterIcon(width, height, appConfig.background, "png", originalIconPath, outputFile);
               
           }
    }
    
}

async function createImageWithFullsizeIcon(width, height, background, format, iconPath, outputPath) {
        var tempSourceDir = path.join(__dirname, "tmp_screenshot_in");
        util.File.rmDir(tempSourceDir);
        util.File.mkDir(tempSourceDir);

        var templatePath = path.join(tempSourceDir, "tmp_template.png");
               // Generate template path
               await sharp({
                    create: {
                    width: width,
                    height: height,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                    }
                })
                .png()
                .toFile(templatePath);

                var iconWidth = width
                var x = 0
                var y = 0
                var iconHeight = height
                
                var templateConfig = {
                    "screenshot": {
                        "x":x,
                        "y":y,
                        "width":iconWidth,
                        "height":iconHeight
                    }
                }

                var templateConfigPath = path.join(tempSourceDir, "tmp_config.json");
                fs.writeFileSync(templateConfigPath, JSON.stringify(templateConfig));

                var command = nodeInterpreter+" "+screengenerator
                    + " --template \""+templatePath+"\""
                    + " --config \""+templateConfigPath+"\""
                    + " --backgroundColor \""+background+"\"" 
                    + " --screenshot \""+iconPath+"\""
                    + " --output \""+outputPath+"\""
                    + " --size \""+width+"x"+height+"\"";       
                
                console.log(command);
                shell.exec(command);

                util.File.rmDir(tempSourceDir);
}

async function createImageWithCenterIcon(width, height, background, format, iconPath, outputPath) {
        var tempSourceDir = path.join(__dirname, "tmp_screenshot_in");
        util.File.rmDir(tempSourceDir);
        util.File.mkDir(tempSourceDir);

        var templatePath = path.join(tempSourceDir, "tmp_template.png");
               // Generate template path
               await sharp({
                    create: {
                    width: width,
                    height: height,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                    }
                })
                .png()
                .toFile(templatePath);

                var iconWidth = width*0.9
                var x = width*0.05
                var y = height/2 - iconWidth/2
                if(height < width) {
                    iconWidth = height*0.9
                    x = width/2 - iconWidth/2
                    y = height*0.05
                }
                var iconHeight = iconWidth
                
                var templateConfig = {
                    "screenshot": {
                        "x":x,
                        "y":y,
                        "width":iconWidth,
                        "height":iconHeight
                    }
                }

                var templateConfigPath = path.join(tempSourceDir, "tmp_config.json");
                fs.writeFileSync(templateConfigPath, JSON.stringify(templateConfig));

                var command = nodeInterpreter+" "+screengenerator
                    + " --template \""+templatePath+"\""
                    + " --config \""+templateConfigPath+"\""
                    + " --backgroundColor \""+background+"\"" 
                    + " --screenshot \""+iconPath+"\""
                    + " --output \""+outputPath+"\""
                    + " --size \""+width+"x"+height+"\"";       
                
                console.log(command);
                shell.exec(command);

                util.File.rmDir(tempSourceDir);
}

function copyIOSSplashscreens() {
    for(platform in platforms) {
        if(platform == "ios") {
            var pathFolder = path.join(platforms[platform])
            var pathToResource = path.join(pathFolder, "res")
            //Splashscreens
            var pathToSplashscreen = path.join(pathToResource, "screen", "ios")
            if (fs.existsSync(pathToSplashscreen)) {

                var files = fs.readdirSync(pathToSplashscreen).forEach(file => {
                        // if(iosSplashscreens[file] !== undefined) {
                        // var command = "cp " + path.join(pathToSplashscreen, file) + " " + path.join(pathFolder, "platforms", "ios", appConfig.name.replace(/ /g, '\\ '), "Images.xcassets", "LaunchImage.launchimage", iosSplashscreens[file])
                        var command = "cp " + path.join(pathToSplashscreen, file) + " " + path.join(pathFolder, "platforms", "ios", appConfig.name.replace(/ /g, '\\ '), "Images.xcassets", "LaunchImage.launchimage", file);
                        console.log(command)
                        shell.exec(command);
                    // }
                });
            }
        }
    }
}

function getAllFiles(pathFolder) {
    return fs.readdirSync(pathFolder)
}

function renameFiles(pathFolder, renameMap) {
    var files = fs.readdirSync(pathFolder).forEach(file => {
            if(renameMap[file] !== undefined) {
                shell.exec("mv " + path.join(pathFolder,file) + " " + path.join(pathFolder,renameMap[file]));
            }
    });
}

function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(dest)) {
        shell.exec("mkdir -p "+dest);
    }
    shell.exec("cp -r "+ src + " " +dest);
}

function createGitPullPath(urlRepo, login, password) {
    var urlRepoParsed = url.parse(urlRepo, true);
    if(login == undefined) {
        return urlRepoParsed.protocol + "//"+urlRepoParsed.host+urlRepoParsed.pathname
    } else {
        return urlRepoParsed.protocol + "//" + login+":"+password+"@"+urlRepoParsed.host+urlRepoParsed.pathname
    }

}

function createHgPullPath(urlRepo, login, password) {
    var urlRepoParsed = url.parse(urlRepo, true);
    return urlRepoParsed.protocol + "//" + login+":"+password+"@"+urlRepoParsed.host+urlRepoParsed.pathname
}

function createBundle(appConfig, platforms) {
    try {
        if (appConfig.Bundle == undefined) return;
        if (appConfig.Bundle.Q != undefined) {
            if (appConfig.Bundle.Q.webProjectPath == undefined || appConfig.Bundle.Q.webProjectPath.length == 0) return;

            var appPath = path.join(appConfig.Bundle.Q.webProjectPath);
            var qPath = path.join(appConfig.Bundle.Q.QProjectPath);
            var installScript = path.join(appPath, "/scripts/Q/install.php");
            var bundleScript = path.join(appPath, "/scripts/Q/bundle.php");

            // Update Q repo
            var pluginsPath = path.join(qPath, "plugins");
            var plugins = getDirectories(pluginsPath);

            for (var dirIndex in plugins) {
                var pluginDir = plugins[dirIndex]
                console.log(pluginDir);
                shell.cd(pluginDir);
                stdout = shell.exec('hg paths', {silent: true}).stdout;
                var parts = stdout.split("=");
                if(parts.length == 2) {
                    var pluginUrl = stdout.split("=")[1].trim()
                    shell.exec("hg pull -u " + createHgPullPath(pluginUrl, appConfig.Bundle.Q.login, appConfig.Bundle.Q.password));
                    shell.exec("hg update");
                }
            }

            // Update repo
            shell.cd(appPath);
            shell.exec("hg pull -u " + createHgPullPath(appConfig.Bundle.Q.url, appConfig.Bundle.Q.login, appConfig.Bundle.Q.password));
            shell.exec("hg update");

            var command = "php " + installScript + "  --all";
            console.log(command);
            execWithLog(command);
            for (platform in platforms) {
                var pathFolder = path.join(platforms[platform], "www/Bundle");
                createFolderIfNotExist(pathFolder);
                execWithLog("php " + bundleScript + " " + pathFolder);
                if (platform === "android") {
                    var androidPathFolder = path.join(platforms[platform], "platforms/android/app/src/main/assets/", "www/Bundle");
                    createFolderIfNotExist(androidPathFolder);
                    var command = "php " + bundleScript + " " + androidPathFolder;
                    console.log(command);
                    execWithLog(command);
                } else if (platform === "ios") {
                    var iosPathFolder = path.join(platforms[platform], "platforms/ios/", "www/Bundle");
                    createFolderIfNotExist(iosPathFolder);
                    var command = "php " + bundleScript + " " + iosPathFolder;
                    console.log(command);
                    execWithLog(command);
                }
            }
        } else if(appConfig.Bundle.Direct != undefined) {
            console.log("Direct bundle")
            for (platform in platforms) {
                var pathFolder = path.join(platforms[platform], "www");
                console.log(pathFolder);

                shell.exec("cd "+pathFolder)
                shell.exec("pwd").output;
                if(appConfig.Bundle.Direct.type =="git") {
                    var tempFolder = path.join(pathFolder, "tmp");
                    util.File.rmDir(tempFolder)
                    util.File.rmDir(pathFolder+"/*")
                    var command = "git clone " + ((appConfig.Bundle.Direct.branch !== undefined) ? " -b "+appConfig.Bundle.Direct.branch+" ":" -b master ")+ createGitPullPath(appConfig.Bundle.Direct.url, appConfig.Bundle.Direct.login, appConfig.Bundle.Direct.password, appConfig.Bundle.Direct.branch) + " "+tempFolder
                    console.log(command);
                    shell.exec(command)
                    util.File.rmDir(path.join(tempFolder, ".git"))
                    shell.exec("cp -r -v "+tempFolder+"/* "+pathFolder);
                    util.File.rmDir(tempFolder)
                } else if(appConfig.Bundle.Direct.type =="hg") {
                    var tempFolder = path.join(pathFolder, "tmp");
                    util.File.rmDir(tempFolder)
                    var command = "hg clone "+createHgPullPath(appConfig.Bundle.Direct.url, appConfig.Bundle.Direct.login, appConfig.Bundle.Direct.password)+" "+((appConfig.Bundle.Direct.branch !== undefined) ? " -r "+appConfig.Bundle.Direct.branch+" ":" -r master ")+" "+tempFolder
                    console.log(command);
                    shell.exec(command)
                    util.File.rmDir(path.join(tempFolder, ".hg"))
                    shell.exec("cp -r -v "+tempFolder+"/* "+pathFolder);
                    util.File.rmDir(tempFolder)
                }
                // if(appConfig.Bundle.Direct.afterRun != undefined) {
                //     shell.exec("cd "+tempFolder)
                //     shell.exec(appConfig.Bundle.Direct.afterRun);
                // }

                const postCommands = appConfig.Bundle.Direct.postCommands;
                if(postCommands != null) {
                    for (platform in platforms) {
                        var pathFolder = path.join(platforms[platform], "www");
                        console.log(pathFolder);

                        shell.exec("cd "+pathFolder)

                        for(indexCommand in postCommands) {
                            var command = postCommands[indexCommand];
                            shell.exec("cd "+pathFolder+" && "+command);
                        }
                    }
                }

                const excludeFolders = appConfig.Bundle.Direct.excludeFolders;
                if(excludeFolders != null) {
                    for (platform in platforms) {
                        var pathFolder = path.join(platforms[platform], "www");
                        console.log(pathFolder);

                        shell.exec("cd "+pathFolder)

                        for(indeFolderToRemove in excludeFolders) {
                            var pathToRemove = path.join(pathFolder, excludeFolders[indeFolderToRemove]);
                            if(fs.existsSync(pathToRemove)) {
                                if(util.File.isDir(pathToRemove)) {
                                    util.File.rmDir(pathToRemove)
                                } else {
                                    util.File.rmFile(pathToRemove)
                                }
                            }
                        }
                    }
                }

                // shell.exec("cd "+platforms[platform]+" && cordova prepare");
            }
        }
    } catch(e) {
        console.error("Exception : "+e)
    }
}

function getDirectoriesWithFiles(srcpath) {
    var result = {};
    var directories = fs.readdirSync(srcpath)
            .map(file => path.join(srcpath, file))
            .filter(path => util.File.isDir(path));

    for(index in directories) {
        var directory = directories[index];
        var files = fs.readdirSync(directory)
            .filter(file => file !== ".DS_Store")
            .map(file => path.join(directory, file))
            .filter(path => fs.statSync(path).isFile());

        result[directory] = files;
    }
    return result;
}

function getFiles(directory) {
        var files = fs.readdirSync(directory)
            .filter(file => file !== ".DS_Store")
            .map(file => path.join(directory, file))
            .filter(path => fs.statSync(path).isFile());

        return files;
}

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath)
            .map(file => path.join(srcpath, file)).filter(path => util.File.isDir(path));
}

function copyQConfig(appConfig, platforms) {
    var config = createQConfigFile(appConfig);

    var configFilename = "config.json";
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        if (fs.existsSync(pathFolder)) {
            fs_extra.writeJsonSync(path.join(pathFolder, configFilename), config)
            if(platform === "android") {
                fs_extra.writeJsonSync(path.join(pathFolder, "platforms/android/app/src/main/assets/", configFilename), config)
            } else if(platform === "ios") {
                var iosResourcePath = path.join(pathFolder, "platforms/ios/", appConfig.name, "Resources");
                createFolderIfNotExist(iosResourcePath);
                fs_extra.writeJsonSync(path.join(iosResourcePath, configFilename), config)
                var projectPath = path.join(pathFolder, '/platforms/ios/', appConfig.name+'.xcodeproj/project.pbxproj');
                var proj = new xcode.project(projectPath);
                proj = proj.parseSync();
                proj.addResourceFile(configFilename);
                fs.writeFileSync(projectPath, proj.writeSync());
            }
        }
    }
}

function createFolderIfNotExist(pathFolder) {
    if (!fs.existsSync(pathFolder)){
        console.log("MkDir "+pathFolder);
        fs.mkdirSync(pathFolder, { recursive: true });
    }
}

function createQConfigFile(appConfig) {
    var config = {};
    config.Q = {};
    config.Q.cordova = {};
    var mainConfig = config.Q.cordova;

    mainConfig.cacheBaseUrl = appConfig.cacheBaseUrl;
    mainConfig.pathToBundle = "www/Bundle";
    mainConfig.injectCordovaScripts = true;
    mainConfig.bundleTimestamp = Math.floor(Date.now() / 1000);
    mainConfig.enableLoadBundleCache = true;
    mainConfig.pingUrl = appConfig.baseUrl;
    mainConfig.url = appConfig.baseUrl;
    mainConfig.baseUrl = appConfig.baseUrl;
    mainConfig.openUrlScheme = appConfig.openUrlScheme;
    mainConfig.userAgentSuffix = appConfig.userAgentSuffix;
    mainConfig.applicationKey = appConfig.applicationKey;

    return config
}

function copyResources(appConfig, appRootPath, platforms) {
    console.log("Copy Resources")
    for(fileIndex in appConfig.resources) {
        var resource = appConfig.resources[fileIndex]
        var sourceFilePath = path.join(appRootPath, resource.path);

        for(platform in resource.platforms) {
            var pathToPlatform = platforms[resource.platforms[platform]]
            var isAvailablePlatform = pathToPlatform != undefined
            if(isAvailablePlatform) {
                var destinationFilePath = path.join(pathToPlatform, path.basename(sourceFilePath));
                if(resource.to != undefined) {
                    destinationFilePath = path.join(pathToPlatform, resource.to, path.basename(sourceFilePath));
                }
                if(util.File.isExistPath(sourceFilePath)) {
                    fs_extra.copySync(sourceFilePath, destinationFilePath);
                }
            }
        }
    }
}

function generatePluginRemoveCL(pluginName, pathToApp) {
    var cl = 'cordova plugin remove '+pluginName

    // cl += " --nosave "
    cl += " --verbose "

    return cl
}

function generatePluginInstallCL(pluginId, pluginOption, pathToApp) {
    var cl = 'cordova plugin add '

    if (pluginOption.git != undefined) {
        cl += " "+pluginOption.git
    } else if(pluginOption.pluginId != undefined) {
        cl += " "+pluginOption.pluginId
    }

    // cl += " --nosave "
    cl += " --verbose "

    if(pluginOption.variables !== undefined) {
        for (variable in pluginOption.variables) {
            cl += " --variable "+variable+"="+pluginOption.variables[variable]
        }
    }

    if(pluginOption.flags !== undefined) {
        for (flag in pluginOption.flags) {
            cl += " "+pluginOption.flags[flag]+" "
        }
    }
    return cl
}

function generatePluginInstallViaPlugman(pluginOption, appDirectory) {
    var commands = [];
    for(platformIndex in pluginOption.platforms) {
        var platform = pluginOption.platforms[platformIndex];
        // plugman install --platform <ios|android|blackberry10|wp8> --project <directory> --plugin <name|url|path> [--plugins_dir <directory>] [--www <directory>] [--variable <name>=<value> [--variable <name>=<value> ...]]
        var cl = 'plugman install --platform '+platform+" --project "+appDestination

        if (pluginOption.git != undefined) {
            cl += " --plugin "+pluginOption.git
        }

        if(pluginOption.variables !== undefined) {
            for (variable in pluginOption.variables) {
                cl += " --variable "+variable+"="+pluginOption.variables[variable]
            }
        }

        commands.push(cl)
    }

    return commands
}


async function testPerformManulaChanges(appConfig, platforms) {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        if(platform == "ios") {
            var projectName = appConfig.name;
            var googleServicePath = path.join(pathFolder, "platforms", "ios","GoogleService-Info.plist");
            var projectPath = path.join(pathFolder, "platforms", "ios", projectName+".xcodeproj","project.pbxproj");

            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();

            var configurations = nonComments(proj.pbxEmbedFrameworksBuildPhaseObj());
            proj.removeFromPbxEmbedFrameworksBuildPhase({
                basename:"WebRTC.xcframework", 
                group:"Embed Frameworks"
            });

            fs.writeFileSync(projectPath, proj.writeSync());
            


// PBXCopyFilesBuildPhase

            // fs.writeFileSync(projectPath, proj.writeSync());
            // var proj = new xcode.project(projectPath);
            // proj = proj.parseSync();
            // var udid = proj.getFirstTarget().uuid
            // var pbxBuildConfigurationSection = proj.pbxXCBuildConfigurationSection()
            // for (key in pbxBuildConfigurationSection){
            //     if(pbxBuildConfigurationSection[key] != undefined && pbxBuildConfigurationSection[key].buildSettings != undefined && pbxBuildConfigurationSection[key].buildSettings['SWIFT_VERSION'] != undefined) {
            //         pbxBuildConfigurationSection[key].buildSettings['SWIFT_VERSION'] = "4.2";
            //     }
            // }
            // fs.writeFileSync(projectPath, proj.writeSync());
        }
    }
}

async function performManulaChanges(appConfig, platforms) {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        if(platform == "ios") {
            // // Add legacy build mode
            var legacyWorkspaceSettingsPath = path.join(pathFolder, "platforms", "ios", appConfig.name+".xcworkspace","xcshareddata","WorkspaceSettings.xcsettings");
            fs.writeFileSync(legacyWorkspaceSettingsPath, '<?xml version="1.0" encoding="UTF-8"?>\n'+
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'+
            '<plist version="1.0">\n'+
            '<dict>\n'+
            // '<key>BuildSystemType</key>\n'+
            // '<string>Original</string>\n'+
            '<key>PreviewsEnabled</key>\n'+
            '<false/>\n'+
            '</dict>\n'+
            '</plist>');

            // var userLegacyWorkspaceSettingsPath = path.join(pathFolder, "platforms", "ios", appConfig.name+".xcworkspace","xcuserdata",require("os").userInfo().username+".xcuserdatad","WorkspaceSettings.xcsettings");
            // if (fs.existsSync(userLegacyWorkspaceSettingsPath)) {
            //     fs.writeFileSync(userLegacyWorkspaceSettingsPath, '<?xml version="1.0" encoding="UTF-8"?>\n'+
            //     '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'+
            //     '<plist version="1.0">\n'+
            //     '<dict>\n'+
            //         '<key>BuildLocationStyle</key>\n'+
            //         '<string>UseAppPreferences</string>\n'+
            //         '<key>CustomBuildLocationType</key>\n'+
            //         '<string>RelativeToDerivedData</string>\n'+
            //         '<key>DerivedDataLocationStyle</key>\n'+
            //         '<string>Default</string>\n'+
            //         '<key>EnabledFullIndexStoreVisibility</key>\n'+
            //         '<false/>\n'+
            //         '<key>IssueFilterStyle</key>\n'+
            //         '<string>ShowActiveSchemeOnly</string>\n'+
            //         '<key>LiveSourceIssuesEnabled</key>\n'+
            //         '<true/>\n'+
            //     '</dict>\n'+
            //     '</plist>')
            // }

            //Modify Pod file
            let podfilePath = path.join(pathFolder, "platforms", "ios", "Podfile");
            var content = fs.readFileSync(podfilePath, "utf8");
            content = insert(content, content.indexOf('project'), "use_frameworks!\n\t");
            // content = insert(content, content.lastIndexOf('end'), "\tpod \"SimpleKeychain\"\n");
            content = content+"\n"+
                "post_install do |installer|\n"+
                "\tinstaller.pods_project.targets.each do |target|\n"+
                "\t\ttarget.build_configurations.each do |config|\n"+
                "\t\t\tconfig.build_settings['ENABLE_BITCODE'] = 'NO'\n"+
                "\t\tend\n"+
                "\tend\n"+
                "end\n";
            console.log(content);
            fs.writeFileSync(podfilePath, content);

            // Run pod install
            console.log("Pod install");
            podfilePath = path.join(pathFolder, "platforms", "ios");
            execWithLog("cd "+podfilePath+" && pod install");

            // Add GoogleService-Info.plist file
            var projectName = appConfig.name;
            var googleServicePath = path.join(pathFolder, "platforms", "ios","GoogleService-Info.plist");
            var projectPath = path.join(pathFolder, "platforms", "ios", projectName+".xcodeproj","project.pbxproj");
            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();
            proj.addResourceFile(googleServicePath);
            fs.writeFileSync(projectPath, proj.writeSync());
            

            // Add Swift 4.0
            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();
            var udid = proj.getFirstTarget().uuid
            var pbxBuildConfigurationSection = proj.pbxXCBuildConfigurationSection()
            for (key in pbxBuildConfigurationSection){
                if(pbxBuildConfigurationSection[key] != undefined && pbxBuildConfigurationSection[key].buildSettings != undefined && pbxBuildConfigurationSection[key].buildSettings['SWIFT_VERSION'] != undefined) {
                    pbxBuildConfigurationSection[key].buildSettings['SWIFT_VERSION'] = "4.2";
                }
            }
            fs.writeFileSync(projectPath, proj.writeSync());

        
            // Add CodeSign to Release
            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();
            var udid = proj.getFirstTarget().uuid
            var pbxBuildConfigurationSection = proj.pbxXCBuildConfigurationSection()
            for (key in pbxBuildConfigurationSection){
                var newKey = key;
                if(pbxBuildConfigurationSection[key].name == "Release") {
                    pbxBuildConfigurationSection[key].buildSettings['CODE_SIGN_IDENTITY'] = "\"iPhone Developer\"";
                    break;
                }
            }
            for (key in pbxBuildConfigurationSection){
                var newKey = key;

                if(pbxBuildConfigurationSection[key].name == "Debug") {
                    var debugBuildConfiguration = pbxBuildConfigurationSection[key].buildSettings['GCC_PREPROCESSOR_DEFINITIONS'];
                    // if(debugBuildConfiguration ==null) {
                    //     pbxBuildConfigurationSection[key].buildSettings['GCC_PREPROCESSOR_DEFINITIONS'] = ["\"$(inherited)\""];
                    //     debugBuildConfiguration = pbxBuildConfigurationSection[key].buildSettings['GCC_PREPROCESSOR_DEFINITIONS'] 
                    // }
                    if(debugBuildConfiguration && debugBuildConfiguration.indexOf("\"DEBUG=1\"") < 0) {
                        pbxBuildConfigurationSection[key].buildSettings['GCC_PREPROCESSOR_DEFINITIONS'].push("\"DEBUG=1\"");
                    }

                    debugBuildConfiguration = pbxBuildConfigurationSection[key].buildSettings['OTHER_SWIFT_FLAGS'];
                    // if(debugBuildConfiguration ==null) {
                    //     pbxBuildConfigurationSection[key].buildSettings['OTHER_SWIFT_FLAGS'] = "$(inherited) ";
                    //     debugBuildConfiguration = pbxBuildConfigurationSection[key].buildSettings['OTHER_SWIFT_FLAGS'] 
                    // }
                    if(debugBuildConfiguration && debugBuildConfiguration.indexOf("-D DEBUG") < 0) {
                        // Remove last \" character from value
                        var otherSwiftFlag = pbxBuildConfigurationSection[key].buildSettings['OTHER_SWIFT_FLAGS'].substring(0, pbxBuildConfigurationSection[key].buildSettings['OTHER_SWIFT_FLAGS'].length-1);
                        pbxBuildConfigurationSection[key].buildSettings['OTHER_SWIFT_FLAGS'] = otherSwiftFlag+" -D DEBUG\"";
                    }

                    console.log(pbxBuildConfigurationSection[key]);
                }
            }
            fs.writeFileSync(projectPath, proj.writeSync());

            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();
            // Modify project structure to support automatic_code_signing fastlane plugin
            var ROOT_DIR = pathFolder;
            if(ROOT_DIR.substr(0, 1) === '/' && fs.existsSync(ROOT_DIR + "/platforms/ios")) {
                var srcFile = path.join(ROOT_DIR, "platforms", "ios",projectName+".xcodeproj","project.pbxproj");
                var projectPbxproj = fs.readFileSync(srcFile, "utf8");
            
                if(projectPbxproj.indexOf("TargetAttributes") === -1) {
                    console.log("Adding TargetAttributes to pbxproj");
                    var udid = proj.getFirstTarget().uuid
                    var pbxBuildConfigurationSection = proj.pbxXCBuildConfigurationSection()
            
                    // var targetAttributes = "\n\t\t\t\tTargetAttributes = {\n\t\t\t\t\t1D6058900D05DD3D006BFB54 = {\n\t\t\t\t\t\tDevelopmentTeam = F72EKUASP5;\n\t\t\t\t\t\tSystemCapabilities = {\n\t\t\t\t\t\t\tcom.apple.Push = {\n\t\t\t\t\t\t\t\tenabled = 1;\n\t\t\t\t\t\t\t};\n\t\t\t\t\t\t};\n\t\t\t\t\t};\n\t\t\t\t};";
                    var targetAttributes = "\n\t\t\t\tTargetAttributes = {\n\t\t\t\t\t"+udid+" = {\n\t\t\t\t\t\tDevelopmentTeam = "+appConfig.signing.ios.team_id+";\n\t\t\t\t\t\t\n\t\t\t\t\tProvisioningStyle = Automatic;\n\t\t\t\t\t\t\n\t\t\t\t\t};\n\t\t\t\t};";
                

                    var searchString = "LastUpgradeCheck = 510;";
                    var lastUpgradeCheckIndex = projectPbxproj.indexOf(searchString);
            
                    projectPbxproj = projectPbxproj.substr(0, lastUpgradeCheckIndex + searchString.length) + targetAttributes + projectPbxproj.substr(lastUpgradeCheckIndex + searchString.length);
                }
            
                fs.writeFileSync(srcFile, projectPbxproj);
            }

            // Add Targer For Screenshot Generator
            var fastlaneFolderPath = path.join(pathFolder, "platforms", "ios","QFastlaneUITests");
            util.File.mkDir(fastlaneFolderPath);

            // Write Info.plist
            var fastlaneInfoPlist = path.join(fastlaneFolderPath,"Info.plist")
            fs.writeFileSync(fastlaneInfoPlist, '<?xml version="1.0" encoding="UTF-8"?>\n'+
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'+
            '<plist version="1.0">\n'+
            '<dict>\n'+
            '<key>CFBundleDevelopmentRegion</key>\n'+
            '<string>$(DEVELOPMENT_LANGUAGE)</string>\n'+
            '<key>CFBundleExecutable</key>\n'+
            '<string>$(EXECUTABLE_NAME)</string>\n'+
            '<key>CFBundleIdentifier</key>\n'+
            '<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>\n'+
            '<key>CFBundleInfoDictionaryVersion</key>\n'+
            '<string>6.0</string>\n'+
            '<key>CFBundleName</key>\n'+
            '<string>$(PRODUCT_NAME)</string>\n'+
            '<key>CFBundlePackageType</key>\n'+
            '<string>BNDL</string>\n'+
            '<key>CFBundleShortVersionString</key>\n'+
            '<string>1.0</string>\n'+
            '<key>CFBundleVersion</key>\n'+
            '<string>1</string>\n'+
            '</dict>\n'+
            '</plist>\n');
            // proj.addResourceFile(fastlaneInfoPlist);

            // Rename QFastlaneUITests_example
            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();
            var templateQFastlaneUITest = path.join(fastlaneFolderPath,"QFastlaneUITests_example.swift")
            var qFastlaneUITest = path.join(fastlaneFolderPath,"QFastlaneUITests.swift")
            shell.exec("mv "+templateQFastlaneUITest+" "+qFastlaneUITest)

            // var qFastlaneUITestRef = proj.addSourceFile(qFastlaneUITest);
            var qFastlaneUITestRef = addBuildFile(proj,qFastlaneUITest);
            
            var snapshotHelper = path.join(fastlaneFolderPath,"SnapshotHelper.swift")
            var snapshotHelperRef = addBuildFile(proj,snapshotHelper);

            var darwinNotificationHelper = path.join(fastlaneFolderPath,"DarwinNotificationCenterBeeper.swift")
            var darwinNotificationHelperRef = addBuildFile(proj,darwinNotificationHelper);

            var fastlaneGroup = proj.addPbxGroup([
                fastlaneInfoPlist,
                qFastlaneUITest,
                snapshotHelper,
                darwinNotificationHelper
            ],"QFastlaneUITests","QFastlaneUITests");

            // var key = proj.pbxCreateGroupWithType("CustomTemplate", undefined, 'CustomTemplate')
            var groups = proj.getPBXObject("PBXGroup");
            var groupKey = undefined;
            for (key in groups) {
                if ('CustomTemplate' == groups[key].name) {
                    groupKey = key
                    var customGroup = groups[key]
                }
            }
    
            proj.addToPbxGroup(fastlaneGroup.uuid, groupKey);

            // proj.addTarget("QFastlaneUITests", "ui_testing","QFastlaneUITests");
            files = [qFastlaneUITestRef.uuid, snapshotHelperRef.uuid, darwinNotificationHelperRef.uuid];//
            var uiTarget = addUITestTarget(proj,"QFastlaneUITests","QFastlaneUITests", files, projectName);

            // Add to workspace
            var workspacePath = path.join(pathFolder, "platforms", "ios", projectName+".xcworkspace", "xcshareddata","xcschemes",projectName+".xcscheme");
            var workspaceContent = readXmlFile(workspacePath)

            var testable = {}

            var testableReference = {};
            testableReference['$'] = {skipped: "NO"};
            var buildableReference = {}
            buildableReference['$'] = {
                BlueprintIdentifier: uiTarget.uuid,
                BlueprintName:"QFastlaneUITests",
                BuildableIdentifier: "primary",
                BuildableName:"QFastlaneUITests.xctest",
                ReferencedContainer:"container:"+projectName+".xcodeproj"
            };
            testableReference['BuildableReference'] = [buildableReference];

            testable["TestableReference"] = testableReference

            workspaceContent.Scheme.TestAction[0].Testables.push(
                testable
            )
            writeXmlFile(workspacePath, workspaceContent);

            
            fs.writeFileSync(projectPath, proj.writeSync());

            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();
            addDebugBuildProperty(proj, projectName, appConfig.packageId[platform]);
            fs.writeFileSync(projectPath, proj.writeSync());

            //Remove WebRTC.xcframework from embeded copy
            var proj = new xcode.project(projectPath);
            proj = proj.parseSync();
            var configurations = nonComments(proj.pbxEmbedFrameworksBuildPhaseObj());
            proj.removeFromPbxEmbedFrameworksBuildPhase({
                basename:"WebRTC.xcframework", 
                group:"Embed Frameworks"
            });
            fs.writeFileSync(projectPath, proj.writeSync());
            
        }
    }
}

function addBuildFile(project, path, opt, group) {
        var file;
        if (group) {
            file = project.addFile(path, group, opt);
        }
        else {
            file = project.addPluginFile(path, opt);
        }
    
        if (!file) return false;
    
        file.target = opt ? opt.target : undefined;
        file.uuid = project.generateUuid();
    
        project.addToPbxBuildFileSection(file);        // PBXBuildFile
        // this.addToPbxSourcesBuildPhase(file);       // PBXSourcesBuildPhase
    
        return file;
}

function addDebugBuildProperty(proj, appName, bundleId) {
    var configurations = nonComments(proj.pbxXCBuildConfigurationSection()),
        key, configuration;
    let build_name = "Debug";

    for (key in configurations){
        configuration = configurations[key];
        console.log("ConfName:"+configuration.name+"; productName: "+configuration.buildSettings["PRODUCT_NAME"]);
        if ((configuration.name === build_name) && (configuration.buildSettings["PRODUCT_NAME"]===appName || (configuration.buildSettings["PRODUCT_NAME"] === "\"$(TARGET_NAME)\"" ))) {
            if(configuration.buildSettings["PRODUCT_BUNDLE_IDENTIFIER"] === bundleId) {
                console.log(configuration)
                const DEBUG_PROP = "\"DEBUG=1\"";
                const GCC_PREPROCESSOR_PROP_KEY = "GCC_PREPROCESSOR_DEFINITIONS";
                let gccPreprocessor = configuration.buildSettings[GCC_PREPROCESSOR_PROP_KEY];
                if(gccPreprocessor == undefined) {
                    gccPreprocessor = ["\"$(inherited)\""];
                }

                if(gccPreprocessor.indexOf(DEBUG_PROP) == -1) {
                    gccPreprocessor.push(DEBUG_PROP);
                }

                configuration.buildSettings[GCC_PREPROCESSOR_PROP_KEY] = gccPreprocessor;


                // OTHER_SWIFT_FLAGS = "$(inherited) -D COCOAPODS -D DEBUG";
                const SWIFT_DEBUG_PROP = "-D DEBUG";
                const OTHER_SWIFT_FLAGS_PROP_KEY = "OTHER_SWIFT_FLAGS";
                configuration.buildSettings[OTHER_SWIFT_FLAGS_PROP_KEY] = "\"$(inherited) -D DEBUG\"";
                console.log(configuration)
            }
        }
    }
}

function nonComments(obj) {
    COMMENT_KEY = /_comment$/
    var keys = Object.keys(obj),
        newObj = {}, i = 0;

    for (i; i < keys.length; i++) {
        if (!COMMENT_KEY.test(keys[i])) {
            newObj[keys[i]] = obj[keys[i]];
        }
    }

    return newObj;
}

function insert(source, index, string) {
    if (index > 0)
        return source.substring(0, index) + string + source.substring(index, source.length);

    return string + source;
}

function addUITestTarget(project, name, subfolder, files, projectName) {
        // Setup uuid and name of new target
        var targetUuid = project.generateUuid(),
            targetType = "ui_testing",
            targetSubfolder = subfolder || name,
            targetName = name.trim();

        var productType = 'com.apple.product-type.bundle.ui-testing'
    
        // Check type against list of allowed target types
        if (!targetName) {
            throw new Error("Target name missing.");
        }
    
        // Check type against list of allowed target types
        if (!targetType) {
            throw new Error("Target type missing.");
        }
    
        // Build Configuration: Create
        var buildConfigurationsList = [
            {
                isa: 'XCBuildConfiguration',
                buildSettings: {
                    ALWAYS_SEARCH_USER_PATHS: 'NO',
				    CLANG_ANALYZER_NONNULL: 'YES',
				    CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: 'YES_AGGRESSIVE',
				    CLANG_CXX_LANGUAGE_STANDARD: '"gnu++14"',
				    CLANG_CXX_LIBRARY: '"libc++"',
				    CLANG_ENABLE_OBJC_WEAK: 'YES',
				    CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING: 'YES',
				    CLANG_WARN_COMMA: 'YES',
				    CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS: 'YES',
				    CLANG_WARN_DIRECT_OBJC_ISA_USAGE: 'YES_ERROR',
				    CLANG_WARN_DOCUMENTATION_COMMENTS: 'YES',
				    CLANG_WARN_INFINITE_RECURSION: 'YES',
				    CLANG_WARN_NON_LITERAL_NULL_CONVERSION: 'YES',
				    CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF: 'YES',
				    CLANG_WARN_OBJC_LITERAL_CONVERSION: 'YES',
				    CLANG_WARN_OBJC_ROOT_CLASS: 'YES_ERROR',
				    CLANG_WARN_RANGE_LOOP_ANALYSIS: 'YES',
				    CLANG_WARN_STRICT_PROTOTYPES: 'YES',
				    CLANG_WARN_SUSPICIOUS_MOVE: 'YES',
				    CLANG_WARN_UNGUARDED_AVAILABILITY: 'YES_AGGRESSIVE',
				    CLANG_WARN_UNREACHABLE_CODE: 'YES',
				    CODE_SIGN_IDENTITY: '"iPhone Developer"',
				    CODE_SIGN_STYLE: 'Automatic',
				    COPY_PHASE_STRIP: 'NO',
				    DEBUG_INFORMATION_FORMAT: 'dwarf',
				    DEVELOPMENT_TEAM: 'U6J99X5R3S',
				    ENABLE_STRICT_OBJC_MSGSEND: 'YES',
				    ENABLE_TESTABILITY: 'YES',
				    GCC_C_LANGUAGE_STANDARD: 'gnu11',
				    GCC_DYNAMIC_NO_PIC: 'NO',
				    GCC_NO_COMMON_BLOCKS: 'YES',
                    GCC_OPTIMIZATION_LEVEL: '0',
                    GCC_PREPROCESSOR_DEFINITIONS: ['"DEBUG=1"', '"$(inherited)"'],
				    GCC_WARN_64_TO_32_BIT_CONVERSION: 'YES',
				    GCC_WARN_ABOUT_RETURN_TYPE: 'YES_ERROR',
                    GCC_WARN_UNINITIALIZED_AUTOS: 'YES_AGGRESSIVE',
                    INFOPLIST_FILE: path.join(targetSubfolder, 'Info.plist'),
                    IPHONEOS_DEPLOYMENT_TARGET: '12.1',
                    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @loader_path/Frameworks"',
				    MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE',
				    MTL_FAST_MATH: 'YES',
                    PRODUCT_BUNDLE_IDENTIFIER: '"com.qbix.ui-test.'+targetName+'"',
                    PRODUCT_NAME: '"$(TARGET_NAME)"',
				    SWIFT_ACTIVE_COMPILATION_CONDITIONS: 'DEBUG',
				    SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
				    SWIFT_VERSION: '4.2',
				    TARGETED_DEVICE_FAMILY: '"1,2"',
                    TEST_TARGET_NAME: projectName,
                },
                name: 'Debug'
            },
            {
                isa: 'XCBuildConfiguration',
                buildSettings: {
                    ALWAYS_SEARCH_USER_PATHS: 'NO',
                    CLANG_ANALYZER_NONNULL: 'YES',
                    CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: 'YES_AGGRESSIVE',
                    CLANG_CXX_LANGUAGE_STANDARD: '"gnu++14"',
                    CLANG_CXX_LIBRARY: '"libc++"',
                    CLANG_ENABLE_OBJC_WEAK: 'YES',
                    CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING: 'YES',
                    CLANG_WARN_COMMA: 'YES',
                    CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS: 'YES',                        
                    CLANG_WARN_DIRECT_OBJC_ISA_USAGE: 'YES_ERROR',
                    CLANG_WARN_DOCUMENTATION_COMMENTS: 'YES',
                    CLANG_WARN_INFINITE_RECURSION: 'YES',
                    CLANG_WARN_NON_LITERAL_NULL_CONVERSION: 'YES',
                    CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF: 'YES',
                    CLANG_WARN_OBJC_LITERAL_CONVERSION: 'YES',
                    CLANG_WARN_OBJC_ROOT_CLASS: 'YES_ERROR',
                    CLANG_WARN_RANGE_LOOP_ANALYSIS: 'YES',
                    CLANG_WARN_STRICT_PROTOTYPES: 'YES',
                    CLANG_WARN_SUSPICIOUS_MOVE: 'YES',
                    CLANG_WARN_UNGUARDED_AVAILABILITY: 'YES_AGGRESSIVE',
                    CLANG_WARN_UNREACHABLE_CODE: 'YES',
                    CODE_SIGN_IDENTITY: '"iPhone Developer"',
                    CODE_SIGN_STYLE: 'Automatic',
                    COPY_PHASE_STRIP: 'NO',
                    DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
                        DEVELOPMENT_TEAM: 'U6J99X5R3S',
                    ENABLE_NS_ASSERTIONS: 'NO',
                    ENABLE_STRICT_OBJC_MSGSEND: 'YES',
                    GCC_C_LANGUAGE_STANDARD: 'gnu11',                        
                    GCC_NO_COMMON_BLOCKS: 'YES',
                    GCC_WARN_64_TO_32_BIT_CONVERSION: 'YES',
                    GCC_WARN_ABOUT_RETURN_TYPE: 'YES_ERROR',
                    GCC_WARN_UNINITIALIZED_AUTOS: 'YES_AGGRESSIVE',
                    INFOPLIST_FILE: path.join(targetSubfolder, 'Info.plist'),
                    IPHONEOS_DEPLOYMENT_TARGET: '12.1',
                    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @loader_path/Frameworks"',
                    MTL_ENABLE_DEBUG_INFO: 'NO',
                    MTL_FAST_MATH: 'YES',
                    PRODUCT_BUNDLE_IDENTIFIER: '"com.qbix.ui-test.'+targetName+'"',
                    PRODUCT_NAME: '"$(TARGET_NAME)"',
                    SWIFT_OPTIMIZATION_LEVEL: '"-Owholemodule"',
                    SWIFT_VERSION: '4.2',
                    TARGETED_DEVICE_FAMILY: '"1,2"',
                    TEST_TARGET_NAME: projectName,
                    VALIDATE_PRODUCT: 'YES'
                },
                name: 'Release',
            }
        ];
    
        // Build Configuration: Add
        var buildConfigurations = project.addXCConfigurationList(buildConfigurationsList, 'Release', 'Build configuration list for PBXNativeTarget "' + targetName +'"');
    
        // Product: Create
        var productName = targetName,
            productType = productType,
            productFileType = "xctest",
            productFile = project.addProductFile(productName+"."+productFileType, { group: 'Copy Files', 'target': targetUuid}),
            productFileName = productFile.basename;
    
    
        // Product: Add to build file list
        project.addToPbxBuildFileSection(productFile);
    
        // Target: Create
        var target = {
                uuid: targetUuid,
                pbxNativeTarget: {
                    isa: 'PBXNativeTarget',
                    buildConfigurationList: buildConfigurations.uuid,
                    buildPhases: [],
                    buildRules: [],
                    dependencies: [],
                    name: targetName,
                    productName: targetName,
                    productReference: productFile.fileRef,
                    productType: '"' + productType + '"',
                }
        };
    
        // Target: Add to PBXNativeTarget section
        project.addToPbxNativeTargetSection(target)
    
        // project.addToPbxFrameworksBuildPhase(file);  

        var newSourceSection = createNewSection(project,"PBXSourcesBuildPhase", "Sources",files);
        var newFrameworkSection = createNewSection(project,"PBXFrameworksBuildPhase", "Frameworks");
        var newResourceSection = createNewSection(project,"PBXResourcesBuildPhase","Resources");
        
        
    
        var targetDependency = addTargetDependency(project, project.getFirstTarget().uuid, [project.getFirstTarget().uuid])
        
        target.pbxNativeTarget.buildPhases.push(newSourceSection.uuid+" /* Sources */");
        target.pbxNativeTarget.buildPhases.push(newFrameworkSection.uuid+" /* Frameworks */");
        target.pbxNativeTarget.buildPhases.push(newResourceSection.uuid+" /* Resources */");
        target.pbxNativeTarget.dependencies.push(targetDependency.value+" /* PBXTargetDependency */");

        // Target: Add uuid to root project
        var newTarget = {
            value: target.uuid,
            comment: target.pbxNativeTarget.name
        };

        project.pbxProjectSection()[project.getFirstProject()['uuid']]['targets'].push(newTarget);
    
        // Return target on success
        return target;
}

function createNewSection(project,sectionName, name, files) {
    var frameworks = project.hash.project.objects[sectionName];
    var rootFramework = undefined;
    for (var key in frameworks){
        if(key.indexOf("_comment") == -1) {
            rootFramework = frameworks[key];
            break;
        }
    }
    var newFrameworkUuid = project.generateUuid()
    var listOfFiles = files != undefined ? files : [];
    var newFramework = {
        isa:sectionName,
        buildActionMask: rootFramework.buildActionMask,
        files: listOfFiles,
        runOnlyForDeploymentPostprocessing: 0
    }
    project.hash.project.objects[sectionName][newFrameworkUuid]= newFramework;
    project.hash.project.objects[sectionName][newFrameworkUuid+"_comment"]= name;

    return {uuid:newFrameworkUuid, section:newFramework}
}

function addTargetDependency(project, target, dependencyTargets) {
    if (!target)
        return undefined;

    var nativeTargets = project.pbxNativeTargetSection();

    if (typeof nativeTargets[target] == "undefined")
        throw new Error("Invalid target: " + target);

    for (var index = 0; index < dependencyTargets.length; index++) {
        var dependencyTarget = dependencyTargets[index];
        if (typeof nativeTargets[dependencyTarget] == "undefined")
            throw new Error("Invalid target: " + dependencyTarget);
        }

    var pbxTargetDependency = 'PBXTargetDependency',
        pbxContainerItemProxy = 'PBXContainerItemProxy',
        pbxTargetDependencySection = project.hash.project.objects[pbxTargetDependency],
        pbxContainerItemProxySection = project.hash.project.objects[pbxContainerItemProxy];

    for (var index = 0; index < dependencyTargets.length; index++) {
        var dependencyTargetUuid = dependencyTargets[index],
            dependencyTargetCommentKey = require('util').format("%s_comment", dependencyTargetUuid),
            targetDependencyUuid = project.generateUuid(),
            targetDependencyCommentKey = require('util').format("%s_comment", targetDependencyUuid),
            itemProxyUuid = project.generateUuid(),
            itemProxyCommentKey = require('util').format("%s_comment", itemProxyUuid),
            itemProxy = {
                isa: pbxContainerItemProxy,
                containerPortal: project.hash.project['rootObject'],
                containerPortal_comment: project.hash.project['rootObject_comment'],
                proxyType: 1,
                remoteGlobalIDString: dependencyTargetUuid,
                remoteInfo: nativeTargets[dependencyTargetUuid].name
            },
            targetDependency = {
                isa: pbxTargetDependency,
                target: dependencyTargetUuid,
                target_comment: nativeTargets[dependencyTargetCommentKey],
                targetProxy: itemProxyUuid,
                targetProxy_comment: pbxContainerItemProxy
            };

        if (pbxContainerItemProxySection && pbxTargetDependencySection) {
            pbxContainerItemProxySection[itemProxyUuid] = itemProxy;
            pbxContainerItemProxySection[itemProxyCommentKey] = pbxContainerItemProxy;
            pbxTargetDependencySection[targetDependencyUuid] = targetDependency;
            pbxTargetDependencySection[targetDependencyCommentKey] = pbxTargetDependency;
            // nativeTargets[target].dependencies.push({ value: targetDependencyUuid, comment: pbxTargetDependency })
        }
    }

    // return { uuid: target, target: nativeTargets[target] };
    return { value: targetDependencyUuid, comment: pbxTargetDependency }
}
