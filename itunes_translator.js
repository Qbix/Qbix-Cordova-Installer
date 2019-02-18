/**
 * Created by adventis on 11/14/18.
 */

var fs = require('fs');
var path = require('path');
var shell = require('shelljs');

var stdio = require('stdio');


var ops = stdio.getopt({
    'script': {key: 's', args: 1, mandatory: true, description: 'Full path to scripts/Q/translate.php'},
    'language': {key: 'l', args:1,  mandatory: true, description: 'Source language'},
    'metadata': {key: 'm', args:1,  mandatory: true, description: 'Path to metadata. Android(platforms/android/fastlane/metadata/android), iOS(platforms/ios/fastlane/metadata/)'},
    'ios':{description: 'Translate for iOS'},
    'android':{description: 'Translate for Android'}
});

var translateScriptPath = "MyApp/scripts/Q/translate.php";
var sourceLanguage =  "en-US";
var pathToMedatada = "build/android/{AppName}/platforms/android/fastlane/metadata/android";

if (ops.script) {
    translateScriptPath = ops.script;
    sourceLanguage = ops.language;
    pathToMedatada = ops.metadata;
    if(ops.ios && ops.android) {
        console.log("Please select one platform")
    }
}
var pathToEnglishMetadta = path.join(pathToMedatada, sourceLanguage);
var ios_metadata_translations = [
    path.join(pathToEnglishMetadta, "description.txt"),
    path.join(pathToEnglishMetadta, "keywords.txt"),
    path.join(pathToEnglishMetadta, "promotional_text.txt"),
    path.join(pathToEnglishMetadta, "release_notes.txt")
];
var android_metadata_translations = [
    path.join(pathToEnglishMetadta, "full_description.txt"),
    path.join(pathToEnglishMetadta, "short_description.txt")
];
var android_not_supported_languages = [
    "da",
    "de",
    "el",
    "es",
    "es-MX",
    "fi",
    "fr",
    "he",
    "hi",
    "it",
    "ja",
    "ko",
    "nl",
    "nn",
    "pt",
    "ru",
    "sv",
    "tr",
    "zh"
];

if(ops.ios) {
    for(index in ios_metadata_translations) {
        var fileName =  ios_metadata_translations[index];
        fileName = fileName.split('/').pop()
        console.log(pathToMedatada);
        console.log(sourceLanguage);
        console.log(fileName);
        translateFile(pathToMedatada, sourceLanguage, fileName, android_not_supported_languages);
    }
} else if(ops.android) {
    for(index in android_metadata_translations) {
        var fileName =  android_metadata_translations[index];
        fileName = fileName.split('/').pop()
        translateFile(pathToMedatada, sourceLanguage, fileName, android_not_supported_languages);
    }
}

function mkDir(src) {
    shell.exec("mkdir -p "+ src);
}

function rmDir(src) {
    shell.exec("rm -rf "+ src);
}

function writeFile(src, text) {
    fs.writeFileSync(src, text , 'utf-8');
}

function readFile(src) {
    return fs.readFileSync(src, 'utf8')
}

function isExist(path) {
    return fs.existsSync(path)
}

function translateFile(pathToMedata, sourceLanguage, sourceFilename, notSupportedLanguages) {

    var pathToFile = path.join(pathToMedata, sourceLanguage, sourceFilename)
    // 1. Convert file to JSON
    var content = readFile(pathToFile);

    var file2json = {};

    var contentLines = content.split(/\r?\n/)
    for(var i = 0; i < contentLines.length;i++){
        file2json[i] = contentLines[i];
    }


    // 2. Write this file in temp source folder
    var tempSourceDir = path.join(__dirname, "tmp_translate_in");
    rmDir(tempSourceDir);
    mkDir(tempSourceDir);
    writeFile(path.join(tempSourceDir, sourceLanguage+".json"), JSON.stringify(file2json, null, 2));

    // 3. Create output folder
    var tempOutputDir = path.join(__dirname, "tmp_translate_output");
    rmDir(tempOutputDir);
    mkDir(tempOutputDir);

    // 4. run translate script
    var command = "php " + translateScriptPath + " --source="+sourceLanguage+" --in="+tempSourceDir+" --out="+tempOutputDir+ " --format=google --google-format=html"
    shell.exec(command).output;

    // 5. move translated data to fastlane
    fs.readdirSync(tempOutputDir).forEach(filename => {
        var lang = filename.split(".")[0];
        if(notSupportedLanguages != null && notSupportedLanguages.indexOf(lang)>-1) {
            return;
        }
        filepath = path.join(tempOutputDir, filename)

        var finalOutputPath = path.join(pathToMedata, lang)
        if(!isExist(finalOutputPath)) {
            mkDir(finalOutputPath)
        }
        var outputFile = path.join(finalOutputPath, sourceFilename)
        var jsonArray = JSON.parse(readFile(filepath))

        var text2write = jsonArray.join('\n')

        writeFile(outputFile, jsonArray.join('\n'));
    });
}




