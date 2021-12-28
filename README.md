Setup Xcode machin

1. Install Xcode from AppStore or using direct link https://developer.apple.com/download/more/
2. Install Android Studio from official site
3. Install brew ```/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"```
4. Install Jenkins ```brew install jenkins-lts```
5. Install ```Environment Injector``` plugin to Jenkins
6. Set global ENV to Manage Jenkins -> Configure System -> Global properties option -> check Environment variables
ANDROID_SDK_PATH, SCREENSHOTGENERATOR_PATH, PHP_PATH, NPM_PATH, NODE_PATH, GOOGLE_PLAY_CREDS, BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY, APPLE_ID_USERNAME, APPLE_ID_PASSWORD, Q_REPO_LOGIN, Q_REPO_PASSWORD
7. Install ```Pipeline Utility Steps```, ```Mercurial```
8. Install ```$ANDROID_HOME/emulator``` to PATH using ~/.bash_profile
9. Install node 14 version
```
brew install node@14
brew unlink node
brew link node@14
node -v
```
10. Add username and password for Q repo to jenkins with id "946a36b2-8868-4eaa-ab82-f2a313cf694a"
11. Install hg ```brew install hg```
12. Install cordova ```npm install -g cordova@9.0.0```
13. Install cocoapods ```sudo gem install cocoapods```
14. Install fastlane ```brew install fastlane```
15. Install jdk  ``` brew tap adoptopenjdk/openjdk && brew install --cask adoptopenjdk8```
16. Install gradle ```brew install gradle```
17. Install SDL 28 via Android Studio
sudo chmod -R 777 /Library/Ruby/Gems/2.6.0
18. install ```fastlane add_plugin firebase_app_distribution``` from ~/
19. sudo gem install screengrab
20. sudo gem install fastlane-plugin-browserstack
21. fastlane add_plugin browserstack
21. npm install -g firebase-tools
22. firebase login
23. sudo xcode-selenanct -switch /Applications/Xcode.app/Contents/Developer
24. edit ~/.zshenv
```
export JAVA_HOME=/Library/Java/JavaVirtualMachines/adoptopenjdk-8.jdk/Contents/Home
export ANDROID_SDK_ROOT=/Users/administrator/Library/Android/sdk
export PATH=$ANDROID_SDK_ROOT:$ANDROID_SDK_ROOT/emulator:$PATH
```
source ~/.zshenv
25. Login in Xcode apple dev account
26. Install emulator
/Users/administrator/Library/Android/sdk/tools/bin/avdmanager list 
/Users/administrator/Library/Android/sdk/tools/bin/avdmanager create avd --force --name "AndroidScreenshotgeneratorEmulator" --abi google_apis_playstore/x86 --package 'system-images;android-30;google_apis_playstore;x86' -d <id_nexus6_emulator>

/Users/administrator/Library/Android/sdk/tools/bin/avdmanager list 
/Users/administrator/Library/Android/sdk/tools/bin/avdmanager create avd --force --name "AndroidTabletScreenshotgeneratorEmulator" --abi google_apis_playstore/x86 --package 'system-images;android-30;google_apis_playstore;x86' -d <id_pixel_c_emulator>

27. Please check if exist emulators:
"iPhone 8 Plus", "iPhone Xs Max", "iPad Pro (12.9-inch) (4th generation)"


1. Setup Environment

```cp environment.json.template environment.json```
Add path to node, php interpreter and Screenshot-Production-GenJS index.js

2. Create project

Follow command create folder with name <Project Name> in current folder

```node <full_path_to_script>/index.js --create <Project Name>```
   
Copy all project files to new created folder

3. Build project

This command build project for platforms which set in config.json["platforms"] array

```node <full_path_to_script>/index.js --build```

4. Deploy to Fabric

```node <full_path_to_script>/index.js --beta fabric```

5. Deploy to Browserstack

```node <full_path_to_script>/index.js --beta browserstack```




Manual changes for iOS:
1. Change package name for ShareExt <main package name>.shareextension
2. Change version and version code the same as main app
3. Enable automatic manage signing

Deploy:
fastlane deploy_draft - first upload


Troubles:
0. This app is not published in the Google Play console.
    Link Firebase to Google Play. Firebase->Project Settings->Integrations->Google Play
1. App Distribution could not generate credentials from the refresh token specified.
    bundle exec fastlane run firebase_app_distribution_login



Cordova 6.x

Common:
1. if app load local file, should manually add cordova.js and cordova_plugins.js files in the of body tag
    <script type="text/javascript" src="cordova.js"></script>
    <script type="text/javascript" src="js/index.js"></script>
    1.1 copy local bundle

2. Add icon in 2048x2048 dimension
2. Use this site (http://pgicons.abiro.com/) to generate splashscreens from icon:
    /////////////////////- ios hasn't next sizes: 1024x748, 1125x2436, 1536x2008, 2436x1125
    For ios need to create
    Default-2436h.png Size: 1125 × 2436 Create from Default@2x~ipad~comany.png
    Default-Landscape-2436h.png Size:2436 × 1125 Create from Default@3x~iphone~anycom
    We no need android splashscreens. Just edit only splashscreens for iOS
3. If use FB sdk, need to register valid url for callback:
    Example: https://<url>/login/facebook?scheme=<openurl>

Android:
1. Setup java version to 1.7
2. Use gradle v 3.5
3. Remove google() repository from build.gradle (Only support from v4.5)
6. If you receive ERROR: spawn EACCES, please get executable permission to gradlew inside project
   //chmod +x /Users/<username>/Documents/<project name>/build/android/<project name>/platforms/android/gradlew
   or
   sudo chmod 755 "/Applications/Android Studio.app/Contents/gradle/gradle-4.6/bin/gradle"
///////////7. Change all + in dependecies on 9.0.0 for com.google.android.gms libs and 12.0.1 for firebase libs.
9. Change all gms libraries on 9.0.0 version without adding any plugin wich fix gradle version conflict
10. Need run emulator before deploy with fastlane

IOS:
0. Select Signing team account. After deselect/select automatically signing
1. if you usee latest xcode please setup old scheme for workspace project.
Goto File->Workspace Settings->BuildSystem->Legacy Build System
1.5 Change name in Info.plist key: "Bundle display name"-> real name
2. Change min support version of pod file to 9.0
2.5. Add GoogleService-Info.plist in Resources
3. Add new pod pod 'SwiftyRSA', '1.2.0'
4.5 Set minimum version os 9.0 in XCODE !!!!!!!!
4.5.5 Enable AppGroup and select package id
5. Setup Q Cordova Release build
   Modify platforms/ios/CordovaApp/Classes/AppDelegate.h:
        #import "Q.h"
   Modify platforms/ios/CordovaApp/Classes/AppDelegate.m
        #import "QDelegate.h"
        #import "<Name>-Swift.h"
        ....
        - (BOOL)application:(UIApplication*)application didFinishLaunchingWithOptions:(NSDictionary*)launchOptions {
            [QDelegate handleLaunchMode:self];

            // In case of using app group
            // [[[QbixAppGroupManager alloc] initWithAppBundleID:[[NSBundle mainBundle] bundleIdentifier]] initApp];

            return [super application:application didFinishLaunchingWithOptions:launchOptions];
        }
        ...
   Modify platforms/ios/MyApp/MyApp-Prefix.pch:
        #import "QConfig.h" // in the end
   Replace in Key.swift
   let range = Range<String.Index>(start..<end)
   to
   let range = start..<end
4. Add "iOS UI Testing Bundle" with name "QFastlaneUITests".
Replace QFastlaneUITests.swift on QFastlaneUITests_example.swift
Add SnapshotHelper.swift

5. Add Firebase Config file
6. If you install plugin "https://github.com/dpa99c/cordova-plugin-cloud-settings" and receive message like "entitelments wrong":
    You need to enable iCloud for your App Identifier in the Apple Member Centre and enable iCloud capability in your Xcode project.(Compatible with Xcode 5)
    Please check name in (info.plist -->Bundle identifier) must be the same as (target-->build settings -->packaging-->Product bundle identifier).
7. Change iPad screenshots from 2048 x 2730 on 2048 x 2732 pixels
8. Check LSApplicationQueriesSchemes for iOS
    BCS:
    groupapp
    groups
