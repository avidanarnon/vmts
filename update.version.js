var replace = require('replace-in-file');
var buildVersion = process.argv[2];

const packageJsonOptions = {
  files: ['package.json', './**/package.json'],
  from: /("version": "0.1.0").*/g,
  to: '"version":"' + buildVersion + '",',
  allowEmptyPaths: false
};

const configurePublicApiVersion = {
  files: 'src/**/index.ts',
  from: [
    /.*(LIBRARY_VERSION).*/g
  ],
  to: [
    'export const LIBRARY_VERSION = \'' + buildVersion + '\';',
  ],
  allowEmptyPaths: false
};

try {
  var packageJsonResult = replace.sync(packageJsonOptions);
  console.log('Updated package configuration to version: ' + buildVersion);
  console.log(packageJsonResult);
  var publicApiResult = replace.sync(configurePublicApiVersion);
  console.log('Update public API to version: ' + buildVersion);
  console.log(publicApiResult);
} catch (error) {
  console.error('Error occurred:', error);
}