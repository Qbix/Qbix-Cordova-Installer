/**
 * Created by adventis on 3/17/18.
 */
var shell = require('shelljs');
var path = require('path');
var fs = require('fs');
var fs_extra = require('fs-extra');
var xcode = require('xcode');
var url = require('url');
xml2js = require('xml2js');
var plist = require('plist');
var sharp = require('sharp');
var stdio = require('stdio');


var ops = stdio.getopt({
    'appconfig': {key: 'c', args: 1, mandatory: true, description: 'Full path to config file'},
    'full_create': {description: 'Create app, Install plugins, Update bundle'},
    'update_plugin': {description: 'Install/Update Plugins, Update bundle'},
    'update_bundle': {description: 'Update bundle'},
});

var appConfig = undefined;
var platforms = {};

main().then(result => {
    console.log("DONE");
});

async function main() {
    var FULL_CREATE = false
    var UPDATE_PLUGIN = false
    var UPDATE_BUNDLE = false
    var BUILD_AFTER = true
    if (ops.appconfig) {
        FULL_CREATE = ops.full_create;
        UPDATE_PLUGIN = ops.update_plugin;
        UPDATE_BUNDLE = ops.update_bundle;
    }
    console.log(ops);
    var pathToConfig = ops.appconfig;
    if (!path.isAbsolute(pathToConfig)) {
        pathToConfig = path.join(__dirname, pathToConfig)
    }

    console.log(pathToConfig);

    appConfig = require(pathToConfig);
    var appNameForOS = appConfig.name.split(" ").join('')
    var appRootPath = path.dirname(pathToConfig)
    var appBuildRootPath = path.join(appRootPath, "build")
// var appDestination = path.join(appBuildRootPath, appNameForOS)

    createFolderIfNotExist(appBuildRootPath);


// Create separate project for each platform

    for (platform in appConfig.platforms) {
        var platformAppDirectory = path.join(appBuildRootPath, appConfig.platforms[platform]);
        createFolderIfNotExist(platformAppDirectory);
        platforms[appConfig.platforms[platform]] = path.join(platformAppDirectory, appNameForOS)
    }


    var FULL_CREATE = false
    var UPDATE_PLUGIN = false
    var UPDATE_BUNDLE = true

    if (FULL_CREATE) {
// Add projects
    addProjects(appNameForOS)

// setupConfig
    setupConfig(appConfig);

// Copy icons
await copyIcons(platforms, appRootPath);

// Add platforms
    addPlatforms();

        // Copy resourcpyResources(appConfig, appRootPath, platforms)
        copyResources(appConfig, appRootPath, platforms)


// Copy splashscreen for ios
    copyIOSSplashscreens();
    }

    if (FULL_CREATE || UPDATE_PLUGIN) {
// Added plugins
// Please not if plugin has string variables you have to wrap it like "/"Some big string/""
//         removePlugins(["com.q.users.cordova"]);
        addPlugins();

    }
    if (FULL_CREATE || UPDATE_PLUGIN || UPDATE_BUNDLE) {

    //    update metadata
    updateMetadata(appConfig, platforms);
    //create bundle
    createBundle(appConfig, platforms)
    //create config.json file for main Q plugin
    copyQConfig(appConfig, platforms);
    // Update name of app
    updateNameOfApp(appConfig, platforms)
    // Create deploy config
    createDeployConfig(appConfig, platforms);
    }

    if(BUILD_AFTER) {
        for(platform in platforms) {
            shell.cd(platforms[platform]);
            shell.exec('cordova build ' + platform).output;
        }
    }
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
            shell.exec('cordova create ' + pathFolder + " " + appConfig.packageId[platform] + " " + appNameForOS).output;
        }
    }
}

function addPlatforms() {
    for(platform in platforms) {
        shell.cd(platforms[platform]);
        shell.exec('cordova platform add ' + platform).output;
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
    for(plugin in appConfig.plugins) {
        var pluginConfig = appConfig.plugins[plugin]

        for (platformIndex in pluginConfig.platforms) {
            var pathToApp = platforms[pluginConfig.platforms[platformIndex]];
            if(pathToApp == undefined)
                continue;

            var pluginOption = appConfig.plugins[plugin];
            shell.cd(pathToApp);
            command = generatePluginInstallCL(plugin, pluginOption, pathToApp)
            shell.exec(command);

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
            platformConfig["allow-navigation"] = [{$: {href: "*"}}]

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
            platformConfig["allow-navigation"] = [{$: {href: "*"}}]

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
        writeXmlFile(path.join(pathFolder, "config.xml"), config);
    }
}

function createDeployConfig(appConfig, platforms) {
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
                    iosScreenshots += ","
                }
                androidScreengrabScreenshots += screen
                iosScreenshots += "\"-init_url "+screen+"\""
            });
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
            fastfileContent = fastfileContent.replace("<screenshots_array>","\""+androidScreengrabScreenshots+"\"");
            fs.writeFileSync(path.join(fastlanePath, "Fastfile"), fastfileContent)
            //Copy Screengrabline
            var screengrablineContent = fs.readFileSync(path.join(fastlaneExamplePath, "Screengrabline"), "utf-8");
            screengrablineContent = screengrablineContent.replace("<screenshots_string>","\""+androidScreengrabScreenshots+"\"")
            fs.writeFileSync(path.join(fastlanePath, "Screengrabline"), screengrablineContent)


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
            fs.writeFileSync(path.join(fastlanePath, "Fastfile"), fastfileContent)
            //Copy Snapfile
            var snapfileContent = fs.readFileSync(path.join(fastlaneExamplePath, "Snapfile"), "utf-8");
            snapfileContent = snapfileContent.replace(/<project_name>/g, appConfig.name);
            snapfileContent = snapfileContent.replace("<screenshots>", iosScreenshots);
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
        }
    }
}

function updateNameOfApp(appConfig, platforms) {
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        if(platform == "android") {
            var stringFilePath = path.join(pathFolder, "platforms", "android", "res", "values", "strings.xml")
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

async function copyIcons(platforms, appRootPath) {
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
        "icon-1024.png":"1024:1024"
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
            "icon-1024.png":"1024:1024"
    };

    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        var pathToResource = path.join(pathFolder, "res")

        var platformPath = path.join(pathToResource, "icon", platform);

        removeDir(path.join(pathToResource, "icon"))
        mkDir(path.join(platformPath))

        console.log(path.join(platformPath))

        var filePromises = [];
        if(platform == "android") {
            for(iconSize in androidIconSize) {
                var size = parseInt(androidIconSize[iconSize].split("x")[0], 10);
                filePromises.push(sharp(originalIconPath).resize(size, size).toFile(path.join(platformPath, iconSize)));
            }
        } else {
            for(iconSize in iosIcons) {
                var size = parseInt(iosIcons[iconSize].split(":")[0], 10);
                if(size == 1024) {
                    // filePromises.push(sharp(originalIconPath).jpeg().resize(size, size).toFile(path.join(platformPath, iconSize.replace(".png", ".jpeg"))));
                    filePromises.push(sharp(originalIconPath).resize(size, size).background({r: 255, g: 255, b: 255, alpha: 1}).toFile(path.join(platformPath, iconSize)));
                } else {
                    filePromises.push(sharp(originalIconPath).resize(size, size).toFile(path.join(platformPath, iconSize)));
                }
            }
        }

        await syncPromises(filePromises);

        removeDir(path.join(pathToResource, "screen"))
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

    console.log("Finish copy icons");
}

function copyIOSSplashscreens() {
    // var iosSplashscreens = {
    //     "1125x2436.png":"Default-2436h.png",
    //     "2436x1125.png":"Default-Landscape-2436h.png",
    //     "2048x1536.png":"Default-Landscape@2x~ipad.png",
    //     "1024x768.png":"Default-Landscape~ipad.png",
    //     "1536x2048.png":"Default-Portrait@2x~ipad.png",
    //     "768x1024.png":"Default-Portrait~ipad.png",
    //     "750x1334.png":"Default-667h.png",
    //     "1242x2208.png":"Default-736h.png",
    //     "2208x1242.png":"Default-Landscape-736h.png",
    //     "640x960.png":"Default@2x~iphone.png",
    //     "640x1136.png":"Default-568h@2x~iphone.png",
    //     "320x480.png":"Default~iphone.png"
    // };
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

function removeDir(src) {
    shell.exec("rm -r "+ src);
}

function mkDir(src) {
    shell.exec("mkdir -p "+ src);
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
    if (appConfig.Bundle == undefined) return;
    if (appConfig.Bundle.Q != undefined) {
        if (appConfig.Bundle.Q.webProjectPath == undefined || appConfig.Bundle.Q.webProjectPath.length == 0) return;

        var bundlePath = path.join(appConfig.Bundle.Q.webProjectPath);
        var qPath = path.join(appConfig.Bundle.Q.QProjectPath);
        var installScript = path.join(bundlePath, "/scripts/Q/install.php");
        var bundleScript = path.join(bundlePath, "/scripts/Q/bundle.php");

        // Update Q repo
        var pluginsPath = path.join(qPath, "platform/plugins");
        var plugins = getDirectories(pluginsPath);

        for (var dirIndex in plugins) {
            var pluginDir = plugins[dirIndex]
            shell.cd(pluginDir);
            stdout = shell.exec('hg paths', {silent: true}).stdout;
            var pluginUrl = stdout.split("=")[1].trim()
            shell.exec("hg pull -u " + createHgPullPath(pluginUrl, appConfig.Bundle.Q.login, appConfig.Bundle.Q.password));
            shell.exec("hg update");
        }

        // Update repo
        shell.cd(bundlePath);
        shell.exec("hg pull -u " + createHgPullPath(appConfig.Bundle.Q.url, appConfig.Bundle.Q.login, appConfig.Bundle.Q.password));
        shell.exec("hg update");

        var result = shell.exec("php " + installScript + "  --all").output;
        console.log('Result ' + result);
        for (platform in platforms) {
            var pathFolder = path.join(platforms[platform], "www/Bundle");
            createFolderIfNotExist(pathFolder);
            shell.exec("php " + bundleScript + " " + pathFolder).output;
            if (platform === "android") {
                var androidPathFolder = path.join(platforms[platform], "platforms/android/assets/", "www/Bundle");
                createFolderIfNotExist(androidPathFolder);
                shell.exec("php " + bundleScript + " " + androidPathFolder).output;
            } else if (platform === "ios") {
                var iosPathFolder = path.join(platforms[platform], "platforms/ios/", "www/Bundle");
                createFolderIfNotExist(iosPathFolder);
                shell.exec("php " + bundleScript + " " + iosPathFolder).output;
            }
        }
    } else if(appConfig.Bundle.Direct != undefined) {
        console.log("Direct bundle")
        for (platform in platforms) {
            var pathFolder = path.join(platforms[platform], "www");

            shell.exec("cd "+pathFolder)
            shell.exec("pwd").output;
            if(appConfig.Bundle.Direct.type =="git") {
                var tempFolder = path.join(pathFolder, "tmp");
                removeDir(tempFolder)
                removeDir(pathFolder+"/*")
                var command = "git clone " + ((appConfig.Bundle.Direct.branch !== undefined) ? " -b "+appConfig.Bundle.Direct.branch+" ":" -b master ")+ createGitPullPath(appConfig.Bundle.Direct.url, appConfig.Bundle.Direct.login, appConfig.Bundle.Direct.password, appConfig.Bundle.Direct.branch) + " "+tempFolder
                console.log(command);
                shell.exec(command)
                removeDir(path.join(tempFolder, ".git"))
                shell.exec("cp -r -v "+tempFolder+"/* "+pathFolder);
                removeDir(tempFolder)
                // shell.exec("mv -f -v "+tempFolder+" "+pathFolder);
            } else if(appConfig.Bundle.Direct.type =="hg") {
                var tempFolder = path.join(pathFolder, "tmp");
                removeDir(tempFolder)
                var command = "hg clone "+createHgPullPath(appConfig.Bundle.Direct.url, appConfig.Bundle.Direct.login, appConfig.Bundle.Direct.password)+" "+((appConfig.Bundle.Direct.branch !== undefined) ? " -r "+appConfig.Bundle.Direct.branch+" ":" -r master ")+" "+tempFolder
                console.log(command);
                shell.exec(command)
                removeDir(path.join(tempFolder, ".hg"))
                shell.exec("cp -r -v "+tempFolder+"/* "+pathFolder);
                removeDir(tempFolder)
            }
            console.log("Cordova folder:" +platforms[platform])
            shell.exec("cd "+platforms[platform]+" && cordova prepare");
        }
    }
}

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath)
            .map(file => path.join(srcpath, file)).filter(path => fs.statSync(path).isDirectory());
}

function copyQConfig(appConfig, platforms) {
    var config = createQConfigFile(appConfig);

    var configFilename = "config.json"
    for(platform in platforms) {
        var pathFolder = path.join(platforms[platform])
        console.log(pathFolder)
        if (fs.existsSync(pathFolder)) {
            fs_extra.writeJsonSync(path.join(pathFolder, configFilename), config)
            if(platform === "android") {
                fs_extra.writeJsonSync(path.join(pathFolder, "platforms/android/assets/", configFilename), config)
            } else if(platform === "ios") {
                var iosResourcePath = path.join(pathFolder, "platforms/ios/", appConfig.name, "Resources");
                createFolderIfNotExist(iosResourcePath);
                fs_extra.writeJsonSync(path.join(iosResourcePath, configFilename), config)
                var projectPath = path.join(pathFolder, '/platforms/ios/', appConfig.name+'.xcodeproj/project.pbxproj');
                var proj = new xcode.project(projectPath);

                proj.parse(function (err) {
                    proj.addResourceFile(configFilename);
                    fs.writeFileSync(projectPath, proj.writeSync());
                    console.log('new project written');
                });
            }
        }
    }
}

function createFolderIfNotExist(pathFolder) {
    if (!fs.existsSync(pathFolder)){
        fs.mkdirSync(pathFolder);
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
    for(fileIndex in appConfig.resources) {
        var resource = appConfig.resources[fileIndex]
        var sourceFilePath = path.join(appRootPath, resource.path);
        console.log(resource);
        console.log(sourceFilePath);

        for(platform in resource.platforms) {
            var pathToPlatform = platforms[resource.platforms[platform]]
            var isAvailablePlatform = pathToPlatform != undefined
            if(isAvailablePlatform) {
                var destinationFilePath = path.join(pathToPlatform, path.basename(sourceFilePath));
                if(resource.to != undefined) {
                    destinationFilePath = path.join(pathToPlatform, resource.to, path.basename(sourceFilePath));
                }
                // console.log("Copy "+sourceFilePath+ " TO "+destinationFilePath);
                fs_extra.copySync(sourceFilePath, destinationFilePath);
                // fs.createReadStream(sourceFilePath).pipe(fs.createWriteStream(destinationFilePath));
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
