var replace = require('replace-in-file');
var buildVersion = process.argv[2];

const packageJsonOptions = {
  files: ['package.json', 'projects/**/package.json'],
  from: /("version":).*/g,
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

const configurePeerDependencies = {
  files: 'projects/**/package.json',
  from: [
    /.*(\"@eobar\/foundation\":).*/g,
  ],
  to: [
    '\"@eobar/foundation\": \"' + buildVersion + '"'
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
  var publicApiResult = replace.sync(configurePeerDependencies);
  console.log('Update peer dependencies: ' + buildVersion);
  console.log(publicApiResult);
} catch (error) {
  console.error('Error occurred:', error);
}