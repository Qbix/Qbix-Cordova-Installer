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









// Please README next manually actions
// For now, will use cordova v6.x
// Android:
//     1. Setup sourceCompatibility to 1.7. Espesially for safariviewcontroller gradle
//
//     Additional
//     google() repository available from gradle 4.4 and we only support Cordova 6.x
//     Works without resolve plugin
// 2. Change all + in dependecies on 9.0.0 for com.google.android.gms libs and 12.0.1 for firebase libs. Also will add next plugins:
//     cordova plugin add cordova-android-play-services-gradle-release --fetch --variable PLAY_SERVICES_VERSION=9.0.0
//     cordova plugin add cordova-android-firebase-gradle-release --fetch --variable FIREBASE_VERSION=12.+
// 0. Setup gradle version to distributionUrl=https\://services.gradle.org/distributions/gradle-3.5-all.zip
//     1. Setup MainActivity
//     2.5 In fcm-plugin will add latest version of gradle like 3.2.0 and setup for all gms plugin 11.4.2 (version may change. See error logs)
//     3. If you receive ERROR: spawn EACCES, please get executable permission to gradlew inside project
//     chmod +x /Users/<username>/Documents/<project name>/build/android/<project name>/platforms/android/gradlew
//     Create gradle.properties in Android project folder and will add next "org.gradle.jvmargs=-Xmx1536M"

// iOS
//     1. Settle AppDelegate
//     2. Add to podfile pod 'SwiftyRSA', '1.2.0', "use_frameworks!" and setup minimal ios version to 8.3
//     3. Run "pod install"
//     ?4. "cd plugins/com.q.cordova/scripts/" and run "node add_swift_support.js"
//     ?5. In QSignManger.m add #import "Track_Email-Swift.h", where  Track_Email == "Track Email" name of app
//     6. Check splashscreens and remove no needed
//     ?7. LOCAL NOTIFICATIONS PLUGIN (https://github.com/katzer/cordova-plugin-local-notifications) doesn't allow receive PN(without content-available:1) and intercept it.
//        Need to fix or remove this plugin!!!!!
//     8. Change orientation. Allow only portrait
//DONE      9. Make sure that in Info.plist present UIViewControllerBasedStatusBarAppearance = false