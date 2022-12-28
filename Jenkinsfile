pipeline {
    agent any
    
    environment {
        
       installerDir="QbixCordovaInstaller"
       installerRepo="https://github.com/Qbix/Qbix-Cordova-Installer.git"
       
       screenGeneratorDir="Screenshot-Production-GenJS"
       screenGeneratorRepo="https://github.com/Qbix/Screenshot-Production-GenJS.git"
       
       
       //SENSITIVE DATA
       android_key_name = ''
       android_sign_key = ''
       androidSigning = ''
       applicationKey = ''
       androidFirebaseConfig = ''
       iosFirebaseConfig = ''
       repoCredentialsId = ''
       
       // NOT SENSITIVE DATA
       bundleRepo = ''
       bundleBranch = ''
       bundleType = '' //could be git
       bundleQProjectPath = ''
       bundleQ = true;
       iosTeamName = ''
       iosTeamId = ''
       localFolderName=''
       fbId = ''
       fbName = ''
        
       //VARIABLE
       bundlePath = ""
       bundleLogin = ""
       bundlePassword = ""
       installerEnvironment = ""
       finalConfig = ""
       deploy_translateQScript=""
    }
    stages {
        stage('Ovveride env') {
            steps {
                script {
                    def props = readProperties file: 'env.properties' 
//                     echo "props"
//                     //SENSITIVE DATA
//                     android_key_name = removeOneQuote(props.android_key_name)
//                     android_sign_key = removeOneQuote(props.android_sign_key)
//                     androidSigning = removeOneQuote(props.androidSigning)
                    
//                     echo "0"
//                     applicationKey = removeOneQuote(props.applicationKey)
//                     androidFirebaseConfig = removeOneQuote(props.androidFirebaseConfig)
//                     iosFirebaseConfig = removeOneQuote(props.iosFirebaseConfig)

//                     repoCredentialsId = removeOneQuote(props.repoCredentialsId)
                     
//                     echo "2"
//                     // NOT SENSITIVE DATA
//                     bundleRepo = removeOneQuote(props.bundleRepo)
//                     bundleBranch = removeOneQuote(props.bundleBranch)
//                     bundleType = removeOneQuote(props.bundleType) //could be git
//                     bundleQProjectPath = removeOneQuote(props.bundleQProjectPath)
//                     bundleQ = removeOneQuote(props.bundleQ)
//                     iosTeamName = removeOneQuote(props.iosTeamName)
//                     iosTeamId = removeOneQuote(props.iosTeamId)
//                     localFolderName=removeOneQuote(props.localFolderName)
//                     fbId = removeOneQuote(props.fbId)
//                     fbName = removeOneQuote(props.fbName)
        
//                     echo "3"
//                     bundleLogin = env.Q_REPO_LOGIN
//                     bundlePassword = env.Q_REPO_PASSWORD
//                     bundlePath = env.WORKSPACE+'/'+localFolderName+'_repo'
//                     deploy_translateQScript = bundlePath+"/scripts/Q/translate.php"
                    
                    echo "4"
                }
            }
        }
        stage('Clone repo') {
            steps {
                dir(installerDir) {
                    git url: installerRepo
                }
                dir(screenGeneratorDir) {
                    git url: screenGeneratorRepo
                }
                checkout([$class: 'MercurialSCM', credentialsId: repoCredentialsId, source: bundleRepo, subdir: bundlePath])
            }
        }
        stage('Setup dependecies') {
            steps {
                sh('node -v')
                sh('npm -v')
                sh('cd '+installerDir+' && '+env.NPM_PATH+' install')
                sh('cd '+screenGeneratorDir+' && '+env.NPM_PATH+' install')
            }
        }
        stage('Create config file') {
            steps {
                
                sh('ls')
                script {
                  
                    sh 'mkdir '+localFolderName+' || true'
 
                    def buildJson = readJSON file: bundlePath+"/config/build.json"
                    
                    def configFilename = 'config.json'
                    
                    echo "Before read common conifg"
                    echo installerDir+"/common_config.json"
                    def commonConfig = readJSON file: installerDir+"/common_config.json"
                    echo "after read common conifg"
                    // echo commonConfig
                    
                    def installerEnvironmentJson = readJSON file: installerDir+"/environment.json.template"
                    installerEnvironment = convertJsonToStr(installerEnvironmentJson)
                    installerEnvironment = installerEnvironment.replace('<full_php_path>',env.PHP_PATH)
                    installerEnvironment = installerEnvironment.replace('<full_node_path>',env.NODE_PATH)
                    installerEnvironment = installerEnvironment.replace('<full_screengenerator_path>', env.WORKSPACE+"/"+screenGeneratorDir)
                    installerEnvironment = installerEnvironment.replace('<android_sdk_path>', env.ANDROID_SDK_PATH)
                    
                    def pluginsJSON = convertJsonToStr(commonConfig.plugins);
                    pluginsJSON = pluginsJSON.replace('{last_word_packageid}',buildJson.packageId.android.tokenize('.').last());
                    pluginsJSON = pluginsJSON.replace('<schema>',buildJson.openUrlScheme);
                    pluginsJSON = pluginsJSON.replace('<FB_ID>',fbId);
                    pluginsJSON = pluginsJSON.replace('<FB_NAME>',fbName);
                    
                   bundle = '{'+
                    '"'+(bundleQ ? "Q":"Direct") +'":{ '+
                      '"url":"'+bundleRepo+'",'+
                      '"branch":"'+bundleBranch+'",'+
                      '"type":"'+bundleType+'",'+
                      '"login":"'+bundleLogin+'",'+
                      '"password":"'+bundlePassword+'",'+
                      '"QProjectPath":"'+bundleQProjectPath+'",'+
                      '"webProjectPath":"'+bundlePath+'"'+
                    '}'+
                   '}'
                    
                    echo "Before final config"
                    def trimedDisplayName = localFolderName
                    def finalJSON = '{'+
                        "name:'"+buildJson.displayName.replace(' ', '')+"',"+
                        "displayName:'"+buildJson.displayName+"',"+
                        "packageId:{"+
                            'android:"'+buildJson.packageId.android+'",'+
                            'ios:"'+buildJson.packageId.ios+'",'+
                        "},"+
                        'versions:{'+
                        'android:{ version:"'+buildJson.versions.android.version+'", code:"'+buildJson.versions.android.code+'"},'+
                        'ios:{ version:"'+buildJson.versions.ios.version+'", code:"'+buildJson.versions.ios.code+'"},'+
                        '},'+
                        'platforms: ["android", "ios"],'+
                        'Bundle:'+bundle+','+
                        'background:"'+buildJson.background+'",'+
                        'splashscreen:{"generate":true},'+
                        'openUrlScheme:"'+buildJson.openUrlScheme+'",'+
                        'cacheBaseUrl:"'+buildJson.cacheBaseUrl+'",'+
                        'baseUrl:"'+buildJson.baseUrl+'",'+
                        'userAgentSuffix:"'+buildJson.userAgentSuffix+'",'+
                        'applicationKey:"'+env.applicationKey+'",'+
                        'resources:'+convertJsonToStr(commonConfig.resources) + "," +
                        "iOSParametersInfoPlist:"+ convertJsonToStr(commonConfig.iOSParametersInfoPlist) + "," +
                        "iOSPreferences:"+ convertJsonToStr(commonConfig.iOSPreferences) + "," +
                        "AndroidPreferences:"+ convertJsonToStr(commonConfig.AndroidPreferences) + "," +
                        "plugins:"+convertJsonToStr(pluginsJSON)+","+
                        "patches:"+convertJsonToStr(commonConfig.patches)+","+
                        "deploy:{"+
                            "locales:"+convertJsonToStr(buildJson.deploy.locales)+","+
                            'subtitle:"'+buildJson.deploy.subtitle.replace('\n', '\\n')+'",'+
                            'shortDescription:"'+buildJson.deploy.shortDescription.replace('\n', '\\n')+'",'+
                            'description:"'+buildJson.deploy.description.replace('\n', '\\n')+'",'+
                            'keywords:"'+buildJson.deploy.keywords+'",'+
                            'privacy_url:"'+buildJson.deploy.privacy_url+'",'+
                            'support_url:"'+buildJson.deploy.support_url+'",'+
                            'marketing_url:"'+buildJson.deploy.marketing_url+'",'+
                            'copyright:"'+buildJson.deploy.copyright+'",'+
                            'release_notes:"'+buildJson.deploy.release_notes+'",'+
                            'review_info:'+convertJsonToStr(buildJson.deploy.review_info)+','+
                            'screenshots:'+convertJsonToStr(buildJson.deploy.screenshots)+','+
                            'translateQScript:"'+deploy_translateQScript+'",'+
                        "},"+
                        'signing:'+'{android:'+androidSigning+',ios:'+ '{appleId:"'+env.APPLE_ID_USERNAME+'", applePassword:"'+env.APPLE_ID_PASSWORD+'", itc_team_name:"'+iosTeamName+'", team_id:"'+iosTeamId+'"}'+'},'+
                        "development:"+'{'+
                            'firebase:{testers:"'+buildJson.testers+'"},'+
                            'browserstack:{username:"'+env.BROWSERSTACK_USERNAME+'", access_key:"'+env.BROWSERSTACK_ACCESS_KEY+'"}'+
                        '}'+
                    '}'
                    
                    // writeJSON file: trimedDisplayName+'/config.json', json: finalJSON
                    finalConfig = convertJsonToStr(finalJSON)
                    echo finalConfig
                }
            }
        }
        stage('Prepare other files for project') {
            steps {
               
                script {
                    def trimedDisplayName = localFolderName
                    
                     // Write config.json file
                    writeJSON file: trimedDisplayName+'/config.json', json: convertStrToJson(finalConfig)
                    
                    // Write google_play_console.json 
                    writeFile file: trimedDisplayName+'/qbix_google_play_console.json', text: env.GOOGLE_PLAY_CREDS
                    
                    writeFile file: trimedDisplayName+'/google-services.json', text: androidFirebaseConfig
                    writeFile file: trimedDisplayName+'/GoogleService-Info.plist', text: iosFirebaseConfig
                    
                    writeFile file: installerDir+"/environment.json", text: installerEnvironment
                    
                    writeFile file: localFolderName+'/'+android_key_name, encoding: 'Base64', text: android_sign_key
                }
              
                sh('cp '+bundlePath+"/web/img/icon/400.png "+localFolderName+"/icon.png")
                sh('touch '+localFolderName+"/.qbix_cordova_installer")
                sh('cat '+installerDir+"/environment.json")
                sh('ls')
            }
        }
        stage('Run build') {
            steps {
                echo "Hello"
                script {
                    sh 'ls'
                    sh 'rm -rf '+localFolderName+'/build || true'
                    sh 'cd '+localFolderName+' && '+env.NODE_PATH+' ../'+installerDir+'/index.js --build'
                }
            }
        }
        stage('Make screenshots') {
            steps {
                sh 'ls'
//                 sh('cd '+localFolderName+' && '+env.NODE_PATH+' ../'+installerDir+'/index.js --screenshots')
//                 sh('cd '+localFolderName+' && '+env.NODE_PATH+' ../'+installerDir+'/index.js --framing')
            }
        }
        stage('Deploy test') {
            steps {
                sh 'ls'
                sh('cd '+localFolderName+' && '+env.NODE_PATH+' ../'+installerDir+'/index.js --beta firebase')
                sh('cd '+localFolderName+' && '+env.NODE_PATH+' ../'+installerDir+'/index.js --beta browserstack')
            }
        }
    }
}


def convertJsonToStr(jsonObj) {
  String jsonString = writeJSON returnText: true, json: jsonObj
  return jsonString
}

def convertStrToJson(jsonStr) {
  def json = readJSON text: jsonStr
  return json
}

def removeOneQuote(string) {
    return string.replace("'","")
}
