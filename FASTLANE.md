Install CLT
    xcode-select --install
Install fastlane
    sudo gem install fastlane -NV
Init fastlane in project root folder
    fastlane init
Init deliver plugin
    [iOS]fastlane deliver init
    [Android] fastlane supply init // Download all metadata from Google Play
Init screenshot plugin
    [iOS]fastlane snapshot init
    [Android]

        1) sudo gem install screengrab
        ...
        4) androidTestCompile 'com.android.support:support-annotations:27.1.1'
           androidTestCompile 'tools.fastlane:screengrab:1.2.0'


           /*androidTestCompile 'junit:junit:4.12'
           androidTestCompile 'com.android.support.test:runner:1.0.2'
           androidTestCompile 'com.android.support.test:rules:1.0.2'
           androidTestCompile 'com.android.support.test.espresso:espresso-core:3.0.2'
           androidTestCompile 'tools.fastlane:screengrab:1.0.0'*/
        ...
        5) add 27.1.1 to all support libraries
        replace "com.android.support:support-v4:x.y.z" on 'com.android.support:appcompat-v7:27.1.1'
        ...
        7) chmod +x gradlew

[iOS]
    Setup Legacy system in Workspace
    Setup script to build app. -allowProvisioningUpdates - allow sign code and update latest provision profiles
        build_app(scheme: "BusinessCardsScan",workspace: "BusinessCardsScan.xcworkspace",include_bitcode: true,export_xcargs: "-allowProvisioningUpdates")

    Setup deliver script
        deliver(ignore_language_directory_validation: true)

    HELP
    Download existing metadata & screenshots
        fastlane deliver download_metadata
        fastlane deliver download_screenshots

    Run fastlane snapshot
        fastlane snapshot


[Android]
    Setup language config in ~/.bash_profile
        export LC_ALL=en_US.UTF-8
        export LANG=en_US.UTF-8
    Create release-signing.properties file in root of Android project and set next key-values
        storeFile=<relative_path, ../../../../../name_of_upload_key>
        storePassword=<password>
        keyAlias=<alias>
        keyPassword=<password>


    Uplaod app signing:
        generate sign key for apk and upload, private key google play create automatically. You should enable special mode before publishing

