#!/usr/bin/env node

const _ = require('lodash');
const path = require('path');
const tmp = require('tmp');
const utils = require('../lib/utils');

const fse = utils.promisifyAll(require('fs-extra'));
const childProcess = utils.promisifyAll(require('child_process'));

const appTemplates = require('../lib/app-templates');

const validateAppTemplate = (template, rootTmpDir) => {
  //const appDir = path.resolve(rootTmpDir, template);
  const zapierCmd = path.resolve(__dirname, '../zapier.js');
  const extraCmd = (template === 'babel') ? ' && rm -rf lib && node_modules/babel-cli/bin/babel.js src --out-dir lib' : '';

  const logFile = path.resolve(__dirname, '..', `${template}.log`);
  const logStream = fse.createWriteStream(logFile);

  console.log(`Validating ${template} app template, writing logs to ${logFile}`);
  return fse.ensureFileAsync(logFile)
    .then(() => {
      return new Promise((resolve, reject) => {
        const cmd = `${zapierCmd} init ${template} --template=${template} --debug && cd ${template} && npm install ${extraCmd} && ${zapierCmd} validate && export CLIENT_ID=1234 CLIENT_SECRET=asdf && ${zapierCmd} test --timeout=5000`;
        const child = childProcess.exec(cmd, {cwd: rootTmpDir}, err => {
          if (err) {
            console.log('error starting child process:', err);
            reject(err);
          }
          resolve();
        });
        child.stdout.pipe(logStream);
        child.stderr.pipe(logStream);
      });
    })
    .then(() => {
      console.log(`${template} template validated successfully`);
      return null;
    })
    .catch(() => {
      console.error(`${template} template validation failed. See ${logFile}.`);
      return template;
    });
};

global.argOpts = {};

const rootTmpDir = tmp.tmpNameSync();
fse.removeSync(rootTmpDir);
fse.ensureDirSync(rootTmpDir);

const tasks = _.map(appTemplates, template => validateAppTemplate(template, rootTmpDir));

Promise.all(tasks)
  .then(results => {
    const failures = _.filter(results, result => result !== null);
    if (failures.length) {
      console.error('these app templates failed to validate:', failures.join(', '));
    } else {
      console.log('app templates validated successfully');
    }
  });
