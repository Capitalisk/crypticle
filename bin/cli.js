#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const childProcess = require('child_process');
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();
const exec = childProcess.exec;
const execSync = childProcess.execSync;
const spawn = childProcess.spawn;
const fork = childProcess.fork;
const YAML = require('yamljs');

const DEFAULT_TLS_SECRET_NAME = 'agc-tls-credentials';

let command = argv._[0];
let commandRawArgs = process.argv.slice(3);
let commandRawArgsString = commandRawArgs.join(' ');
if (commandRawArgsString.length) {
  commandRawArgsString = ' ' + commandRawArgsString;
}

let arg1 = argv._[1];
let force = argv.force ? true : false;
let gke = argv.gke ? true : false;
let targetBlockchain = (argv.b || 'rise').toLowerCase();

let dockerUsername, dockerPassword;
let saveDockerAuthDetails = null;

let tlsSecretName = null;
let tlsKeyPath = null;
let tlsCertPath = null;

let fileExistsSync = function (filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
  } catch (err) {
    return false;
  }
  return true;
};

let parseJSONFile = function (filePath) {
  try {
    if (fileExistsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));
    }
  } catch (e) {}

  return {};
};

let isYAMLFile = function (filePath) {
  return /[.]ya?ml$/.test(filePath);
};

let parsePackageFile = function (moduleDir) {
  let packageFile = path.join(moduleDir, 'package.json');
  return parseJSONFile(packageFile);
};

let errorMessage = function (message) {
  console.log(`\x1b[31m[Error]\x1b[0m ${message}`);
};

let successMessage = function (message) {
  console.log(`\x1b[32m[Success]\x1b[0m ${message}`);
};

let warningMessage = function (message) {
  console.log(`\x1b[33m[Warning]\x1b[0m ${message}`);
};

let showCorrectUsage = function () {
  console.log('Usage: crypticle [options] [command]\n');
  console.log('Options:');
  console.log("  -v            Get the version of the current Crypticle installation");
  console.log('  --help        Get info on how to use this command');
  console.log('  --force       Force all necessary directory modifications without prompts');
  console.log();
  console.log('Commands:');
  console.log('  create <service-name>       Create a new service config tree in your working directory');
  console.log('    -b <blockchain-name>      The name of the blockchain to use (lowercase), defaults to rise');
  console.log('  run <path>                  [requires docker] Run the service at path inside a container on your local machine');
  console.log('    -c                        Use the container network instead of the host network');
  console.log('    -p <port-number>          The port number on which to expose the service - Only works with container network');
  console.log('  restart <path>              [requires docker] Restart the service at path');
  console.log('  stop <path>                 [requires docker] Stop the service');
  console.log('  list                        [requires docker] List all running Docker containers on your local machine');
  console.log('  logs <path>                 [requires docker] Get logs for the specified service');
  console.log('    -f                        Follow the logs');
  console.log('  deploy <path>               [requires kubectl] Deploy the service at path to your Kubernetes cluster');
  console.log('  deploy-update <path>        [requires kubectl] Deploy update to an service which was previously deployed');
  console.log('  undeploy <path>             [requires kubectl] Shutdown all core services running on your cluster');
  console.log('  add-tls-secret              [requires kubectl] Upload a TLS key and cert pair to your cluster');
  console.log(`    -s <secret-name>          Optional secret name; defaults to "${DEFAULT_TLS_SECRET_NAME}"`);
  console.log('    -k <path>                 Path to a key file');
  console.log('    -c <path>                 Path to a certificate file');
  console.log('  remove-tls-secret           [requires kubectl] Remove a TLS key and cert pair from your cluster');
  console.log(`    -s <secret-name>          Optional secret name; defaults to "${DEFAULT_TLS_SECRET_NAME}"`);
  console.log('');
  let extraMessage = 'Note that the path in the commands above is optional - If not provided, ' +
    'crypticle will use the current working directory as the path.';
  console.log(extraMessage);
};

let failedToRemoveDirMessage = function (dirPath) {
  errorMessage(
    `Failed to remove existing directory at ${dirPath}. This directory may be used by another program or you may not have the permission to remove it.`
  );
};

let failedToCreateMessage = function () {
  errorMessage('Failed to create necessary files. Please check your permissions and try again.');
};

let promptInput = function (message, callback, secret) {
  prompt([
    {
      type: secret ? 'password' : 'input',
      message: message,
      name: 'result',
      default: null
    }
  ]).then((answers) => {
    callback(answers.result);
  }).catch((err) => {
    errorMessage(err.message);
    process.exit();
  });
};

let promptConfirm = function (message, options, callback) {
  let promptOptions = {
    type: 'confirm',
    message: message,
    name: 'result'
  };
  if (options && options.default) {
    promptOptions.default = options.default;
  }
  prompt([
    promptOptions
  ]).then((answers) => {
    callback(answers.result);
  }).catch((err) => {
    errorMessage(err.message);
    process.exit();
  });
};

let copyDirRecursive = function (src, dest) {
  try {
    fs.copySync(src, dest);
    return true;
  } catch (e) {
    failedToCreateMessage();
  }
  return false;
};

let rmdirRecursive = function (dirname) {
  try {
    fs.removeSync(dirname);
    return true;
  } catch (e) {
    failedToRemoveDirMessage(dirname);
  }
  return false;
};

let sanitizeYAML = function (yamlString) {
  return yamlString.replace(/emptyDir: ?(null)?\n/g, 'emptyDir: {}\n');
};

if (argv.help) {
  showCorrectUsage();
  process.exit();
};

if (argv.v) {
  let agDir = path.resolve(__dirname, '..');
  let agPkg = parsePackageFile(agDir);
  console.log('v' + agPkg.version);
  process.exit();
};

let supportedBlockchains = {
  'rise': true,
  'lisk': true
};

let sourceBlockchainDir = supportedBlockchains[targetBlockchain] ? targetBlockchain : 'rise';

let wd = process.cwd();

let destDir = path.normalize(`${wd}/${arg1}`);
let dockerfileSourceFile = path.resolve(__dirname, '..', 'Dockerfile-project');
let dockerfileDestFile = path.resolve(destDir, 'Dockerfile');
let dockerignoreSourceFile = path.resolve(__dirname, '..', '.dockerignore');
let dockerignoreDestFile = path.resolve(destDir, '.dockerignore');
let blockchainsSourceDir = path.resolve(__dirname, '..', 'blockchains', sourceBlockchainDir);
let blockchainsDestDir = path.resolve(destDir, 'blockchains', targetBlockchain);
let blockchainsSourcePackageFile = path.resolve(__dirname, '..', 'blockchains', 'package.json');
let blockchainsDestPackageFile = path.resolve(destDir, 'blockchains','package.json');
let blockchainsSourcePackageLockFile = path.resolve(__dirname, '..', 'blockchains', 'package-lock.json');
let blockchainsDestPackageLockFile = path.resolve(destDir, 'blockchains','package-lock.json');
let kubernetesSourceDir = path.resolve(__dirname, '..', 'kubernetes');
let kubernetesDestDir = path.resolve(destDir, 'kubernetes');
let deploymentYAMLRegex = /-deployment\.yaml$/;

let createFail = function (error) {
  if (error) {
    errorMessage(`Failed to create Crypticle project. ${error}`);
  } else {
    errorMessage('Failed to create Crypticle project.');
  }
  process.exit();
};

let createSuccess = function () {
  console.log('Installing service dependencies using npm. This could take a while...');

  let npmCommand = (process.platform === "win32" ? "npm.cmd" : "npm");
  let options = {
    cwd: destDir,
    maxBuffer: Infinity
  };

  let npmProcess = spawn(npmCommand, ['install'], options);

  npmProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  npmProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  npmProcess.on('close', (code) => {
    if (code) {
      errorMessage(`Failed to install npm dependencies. Exited with code ${code}.`);
    } else {
      successMessage(`Crypticle service "${destDir}" was setup successfully.`);
    }
    process.exit(code);
  });

  npmProcess.stdin.end();
};

let setupMessage = function () {
  console.log('Creating project structure...');
};

let confirmReplaceSetup = function (confirm) {
  if (confirm) {
    setupMessage();
    if (
      rmdirRecursive(destDir) &&
      copyDirRecursive(blockchainsSourceDir, blockchainsDestDir) &&
      copyDirRecursive(blockchainsSourcePackageFile, blockchainsDestPackageFile) &&
      copyDirRecursive(blockchainsSourcePackageLockFile, blockchainsDestPackageLockFile) &&
      copyDirRecursive(kubernetesSourceDir, kubernetesDestDir) &&
      copyDirRecursive(dockerfileSourceFile, dockerfileDestFile) &&
      copyDirRecursive(dockerignoreSourceFile, dockerignoreDestFile)
    ) {
      createSuccess();
    } else {
      createFail();
    }
  } else {
    errorMessage('Crypticle "create" action was aborted.');
    process.exit();
  }
};

let getCrypticleWorkerDeploymentDefPath = function (kubernetesTargetDir) {
  return `${kubernetesTargetDir}/crypticle-worker-deployment.yaml`;
};

let localPathStorageConfigFileName = 'local-path-storage.yaml';

let getAGCBrokerDeploymentDefPath = function (kubernetesTargetDir) {
  return `${kubernetesTargetDir}/agc-broker-deployment.yaml`;
};

let promptSecret = function (callback) {
  promptInput(`Insert a TLS secretName for Kubernetes (or press enter to leave it as "${DEFAULT_TLS_SECRET_NAME}" - Recommended):`, (secretName) => {
    secretName = secretName || DEFAULT_TLS_SECRET_NAME;
    promptInput('Insert the path to a private key file to upload to K8s (or press enter to cancel):', (privateKeyPath) => {
      if (!privateKeyPath) {
        callback();
        return;
      }
      promptInput('Insert the path to a certificate file to upload to K8s (or press enter to cancel):', (certFilePath) => {
        if (!certFilePath) {
          callback();
          return;
        }
        tlsSecretName = secretName;
        tlsKeyPath = privateKeyPath;
        tlsCertPath = certFilePath;
        callback(secretName, privateKeyPath, certFilePath);
      });
    });
  });
};

let promptK8sTLSCredentials = function (callback) {
  promptConfirm('Would you like to upload a TLS private key and certificate to your cluster for HTTPS access? (both files must be unencrypted)', {default: true}, (provideKeyAndCert) => {
    if (provideKeyAndCert) {
      promptSecret(callback);
    } else {
      callback();
    }
  });
};

let uploadTLSSecret = function (secretName, privateKeyPath, certFilePath, errorLogger) {
  try {
    execSync(`kubectl create secret tls ${secretName} --key ${privateKeyPath} --cert ${certFilePath}`, {stdio: 'inherit'});
  } catch (err) {
    errorLogger(
      'Failed to upload TLS key and certificate pair to Kubernetes. ' +
      'You can try using the following command to upload them manually: ' +
      `kubectl create secret tls ${secretName} --key ${privateKeyPath} --cert ${certFilePath}`
    );
    return false;
  }
  return true;
};

let uploadSecret = function (secretName, secretValue, errorLogger) {
  try {
    execSync(`kubectl create secret generic ${secretName} –from-literal ${secretValue}`, {stdio: 'inherit'});
  } catch (err) {
    errorLogger(
      'Failed to upload TLS key and certificate pair to Kubernetes. ' +
      'You can try using the following command to upload them manually: ' +
      `kubectl create secret tls ${secretName} --key ${privateKeyPath} --cert ${certFilePath}`
    );
    return false;
  }
  return true;
};

let removeTLSSecret = function (secretName, errorLogger) {
  try {
    execSync(`kubectl delete secret ${secretName}`, {stdio: 'inherit'});
  } catch (err) {
    errorLogger(
      `Failed to remove TLS key and certificate pair "${secretName}" from Kubernetes. ` +
      'You can try using the following command to remove them manually: ' +
      `kubectl delete secret ${secretName}`
    );
    return false;
  }
  return true;
};

if (command === 'create') {
  let transformK8sConfigs = function (callback) {
    let kubernetesTargetDir = destDir + '/kubernetes';
    let kubeConfAGCWorker = getCrypticleWorkerDeploymentDefPath(kubernetesTargetDir);
    try {
      let kubeConfContentAGCWorker = fs.readFileSync(kubeConfAGCWorker, {encoding: 'utf8'});
      let deploymentConfAGCWorker = YAML.parse(kubeConfContentAGCWorker);

      if (!deploymentConfAGCWorker.spec.template.spec.volumes) {
        deploymentConfAGCWorker.spec.template.spec.volumes = [];
      }
      deploymentConfAGCWorker.spec.template.spec.volumes.push({
        name: 'blockchain-src-volume',
        emptyDir: {}
      });
      let containers = deploymentConfAGCWorker.spec.template.spec.containers;
      let templateSpec = deploymentConfAGCWorker.spec.template.spec;
      if (!templateSpec.initContainers) {
        templateSpec.initContainers = [];
      }
      let initContainers = templateSpec.initContainers;
      let serviceWorkerContainerIndex;
      containers.forEach((value, index) => {
        if (value && value.name == 'crypticle-worker') {
          serviceWorkerContainerIndex = index;
          return;
        }
      });
      if (!containers[serviceWorkerContainerIndex].volumeMounts) {
        containers[serviceWorkerContainerIndex].volumeMounts = [];
      }
      containers[serviceWorkerContainerIndex].volumeMounts.push({
        name: 'blockchain-src-volume',
        mountPath: '/usr/src/blockchains'
      });
      containers[serviceWorkerContainerIndex].env.push({
        name: 'BLOCKCHAIN',
        value: targetBlockchain
      });
      containers[serviceWorkerContainerIndex].env.push({
        name: 'SECRET_SIGNUP_KEY',
        valueFrom: {
          secretKeyRef: {
            name: 'crypticle-secret',
            key: 'SECRET_SIGNUP_KEY'
          }
        }
      });
      containers[serviceWorkerContainerIndex].env.push({
        name: 'AUTH_KEY',
        valueFrom: {
          secretKeyRef: {
            name: 'crypticle-secret',
            key: 'AUTH_KEY'
          }
        }
      });
      containers[serviceWorkerContainerIndex].env.push({
        name: 'BLOCKCHAIN_WALLET_PASSPHRASE',
        valueFrom: {
          secretKeyRef: {
            name: 'crypticle-secret',
            key: 'BLOCKCHAIN_WALLET_PASSPHRASE'
          }
        }
      });
      containers[serviceWorkerContainerIndex].env.push({
        name: 'STORAGE_ENCRYPTION_KEY',
        valueFrom: {
          secretKeyRef: {
            name: 'crypticle-secret',
            key: 'STORAGE_ENCRYPTION_KEY'
          }
        }
      });
      initContainers.push({
        name: 'blockchain-src-container',
        image: '', // image name will be generated during deployment
        volumeMounts: [{
          name: 'blockchain-src-volume',
          mountPath: '/usr/dest'
        }],
        command: ['cp', '-a', '/usr/src/blockchains/.', '/usr/dest/']
      });
      let formattedYAMLString = sanitizeYAML(YAML.stringify(deploymentConfAGCWorker, Infinity, 2));
      fs.writeFileSync(kubeConfAGCWorker, formattedYAMLString);
    } catch (err) {
      callback(err);
      return;
    }
    callback();
  };

  if (arg1) {
    if (fileExistsSync(destDir)) {
      if (force) {
        confirmReplaceSetup(true);
      } else {
        let message = `There is already a directory at ${destDir}. Do you want to overwrite it?`;
        promptConfirm(message, {default: true}, confirmReplaceSetup);
      }
    } else {
      setupMessage();
      if (
        copyDirRecursive(blockchainsSourceDir, blockchainsDestDir) &&
        copyDirRecursive(blockchainsSourcePackageFile, blockchainsDestPackageFile) &&
        copyDirRecursive(blockchainsSourcePackageLockFile, blockchainsDestPackageLockFile) &&
        copyDirRecursive(kubernetesSourceDir, kubernetesDestDir) &&
        copyDirRecursive(dockerfileSourceFile, dockerfileDestFile) &&
        copyDirRecursive(dockerignoreSourceFile, dockerignoreDestFile)
      ) {
        transformK8sConfigs((err) => {
          if (err) {
            createFail(`Failed to format Kubernetes configs. ${err}`);
          } else {
            createSuccess();
          }
        });
      } else {
        createFail();
      }
    }
  } else {
    errorMessage('The "create" command requires a valid <service-name> as argument.');
    showCorrectUsage();
    process.exit();
  }
} else if (command === 'run') {
  let projectPath = arg1 || '.';
  let absoluteProjectPath = path.resolve(projectPath);
  let absoluteBlockchainSrcPath = path.resolve(absoluteProjectPath, 'blockchains');
  let serviceName = path.parse(absoluteProjectPath).base;

  let hostNetwork = !argv.c;
  let portNumber = Number(argv.p) || 8000;
  let envVarList;
  if (argv.e === undefined) {
    envVarList = [];
  } else if (!Array.isArray(argv.e)) {
    envVarList = [argv.e];
  } else {
    envVarList = argv.e;
  }
  let envFlagList = envVarList.map((value) => {
    return `-e "${value}"`;
  });
  let isBlockchainSpecified = envFlagList.find((value) => {
    return value.split('=')[0] === 'BLOCKCHAIN';
  });
  if (!isBlockchainSpecified) {
    let blockchain = (fs.readdirSync(absoluteBlockchainSrcPath)[0] || 'rise').toLowerCase();
    envFlagList.push(`-e "BLOCKCHAIN=${blockchain}"`);
  }
  let envFlagString = envFlagList.join(' ');
  if (envFlagList.length > 0) {
    envFlagString += ' ';
  }

  let portString = '';
  let networkString = '';

  if (hostNetwork) {
    networkString = ' --network=host';
    if (portNumber !== 8000) {
      portString = ` -p ${portNumber}:8000`;
    }
  } else {
    portString = ` -p ${portNumber}:8000`;
  }

  try {
    execSync(`docker stop ${serviceName}`, {stdio: 'ignore'});
    execSync(`docker rm ${serviceName}`, {stdio: 'ignore'});
  } catch (e) {}

  let dockerCommand = `docker run -d${portString} -v ${absoluteProjectPath}/blockchains/:/usr/src/blockchains/ ` +
    `${envFlagString}--name ${serviceName}${networkString} socketcluster/crypticle:v2.0.3`;
  try {
    execSync(dockerCommand, {stdio: 'inherit'});
    successMessage(`Service "${serviceName}" is running at http://localhost:${portNumber}`);
  } catch (e) {
    errorMessage(`Failed to start service "${serviceName}".`);
  }
  process.exit();
} else if (command === 'restart') {
  let serviceName = arg1;
  if (!serviceName) {
    let projectPath = '.';
    let absoluteProjectPath = path.resolve(projectPath);
    serviceName = path.parse(absoluteProjectPath).base;
  }
  try {
    execSync(`docker stop ${serviceName}`, {stdio: 'ignore'});
    successMessage(`Service '${serviceName}' was stopped.`);
  } catch (e) {}
  try {
    execSync(`docker start ${serviceName}`);
    successMessage(`Service '${serviceName}' is running.`);
  } catch (e) {
    errorMessage(`Failed to start service '${serviceName}'.`);
  }
  process.exit();
} else if (command === 'stop') {
  let serviceName = arg1;
  if (!serviceName) {
    let projectPath = '.';
    let absoluteProjectPath = path.resolve(projectPath);
    serviceName = path.parse(absoluteProjectPath).base;
  }
  try {
    execSync(`docker stop ${serviceName}`);
    execSync(`docker rm ${serviceName}`);
    successMessage(`Service '${serviceName}' was stopped.`);
  } catch (e) {
    errorMessage(`Failed to stop service '${serviceName}'.`);
  }
  process.exit();
} else if (command === 'list') {
  let command = exec(`docker ps${commandRawArgsString}`, (err) => {
    if (err) {
      errorMessage(`Failed to list active containers. ` + err);
    }
    process.exit();
  });
  command.stdout.pipe(process.stdout);
  command.stderr.pipe(process.stderr);
} else if (command === 'logs') {
  let serviceName = arg1;
  if (!serviceName) {
    let projectPath = '.';
    let absoluteProjectPath = path.resolve(projectPath);
    serviceName = path.parse(absoluteProjectPath).base;
  }
  let command = exec(`docker logs ${serviceName}${commandRawArgsString}`, (err) => {
    if (err) {
      errorMessage(`Failed to get logs for '${serviceName}' service. ` + err);
    }
    process.exit();
  });
  command.stdout.pipe(process.stdout);
  command.stderr.pipe(process.stderr);
} else if (command === 'deploy' || command === 'deploy-update') {
  let projectPath = arg1 || '.';
  let absoluteProjectPath = path.resolve(projectPath);
  let serviceName = path.parse(absoluteProjectPath).base;

  let isUpdate = (command === 'deploy-update');

  let targetCPUUtilization = 50;
  let maxPodsPerService = 10;

  let failedToDeploy = function (err) {
    errorMessage(`Failed to deploy the '${serviceName}' service. ${err.message}`);
    process.exit();
  };

  let crypticleK8sConfigFilePath = projectPath + '/crypticle-k8s.json';
  let crypticleK8sConfig = parseJSONFile(crypticleK8sConfigFilePath);

  let addAuthDetailsToCrypticleK8s = function (crypticleK8sConfigJSON, username, password) {
    if (!crypticleK8sConfigJSON.docker) {
      crypticleK8sConfigJSON.docker = {};
    }
    crypticleK8sConfigJSON.docker.auth = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  };

  let saveCrypticleK8sConfigFile = function (crypticleK8sConfigJSON) {
    fs.writeFileSync(crypticleK8sConfigFilePath, JSON.stringify(crypticleK8sConfigJSON, null, 2));
  };

  let parseVersionTag = function (fullImageName) {
    let matches = fullImageName.match(/:[^:]*$/);
    if (!matches) {
      return '';
    }
    return matches[0] || '';
  };

  let setImageVersionTag = function (imageName, versionTag) {
    if (versionTag.indexOf(':') != 0) {
      versionTag = ':' + versionTag;
    }
    return imageName.replace(/(\/[^\/:]*)(:[^:]*)?$/g, `$1${versionTag}`);
  };

  let promptDockerAuthDetails = function (callback) {
    let handleSaveDockerAuthDetails = function (saveAuthDetails) {
      saveDockerAuthDetails = saveAuthDetails;
      callback(dockerUsername, dockerPassword, saveDockerAuthDetails);
    };

    let promptSaveAuthDetails = function () {
      promptConfirm(`Would you like to save your Docker registry username and password as Base64 to ${crypticleK8sConfigFilePath}?`, {default: true}, handleSaveDockerAuthDetails);
    };

    let handlePassword = function (password) {
      dockerPassword = password;
      if (saveDockerAuthDetails != null) {
        handleSaveDockerAuthDetails(saveDockerAuthDetails);
        return;
      }
      promptSaveAuthDetails();
    };

    let handleUsername = function (username) {
      dockerUsername = username;
      if (dockerPassword != null) {
        handlePassword(dockerPassword);
        return;
      }
      promptInput('Enter your Docker registry password:', handlePassword, true);
    };

    let promptUsername = function () {
      if (dockerUsername != null) {
        handleUsername(dockerUsername);
        return;
      }
      promptInput('Enter your Docker registry username:', handleUsername);
    };

    promptUsername();
  };

  let performDeployment = function (dockerConfig, versionTag, username, password) {
    let dockerLoginCommand = `docker login -u ${username} -p ${password}`;

    let fullVersionTag;
    if (versionTag) {
      fullVersionTag = `:${versionTag}`;
    } else {
      fullVersionTag = parseVersionTag(dockerConfig.imageName);
    }
    dockerConfig.imageName = setImageVersionTag(dockerConfig.imageName, fullVersionTag);
    if (saveDockerAuthDetails) {
      addAuthDetailsToCrypticleK8s(crypticleK8sConfig, username, password);
    }
    try {
      saveCrypticleK8sConfigFile(crypticleK8sConfig);

      execSync(`docker build -t ${dockerConfig.imageName} .`, {stdio: 'inherit'});
      execSync(`${dockerLoginCommand}; docker push ${dockerConfig.imageName}`, {stdio: 'inherit'});

      if (tlsSecretName && tlsKeyPath && tlsCertPath) {
        uploadTLSSecret(tlsSecretName, tlsKeyPath, tlsCertPath, warningMessage);
      }

      let kubernetesDirPath = projectPath + '/kubernetes';

      let kubeConfAGCWorker = getCrypticleWorkerDeploymentDefPath(kubernetesDirPath);
      let kubeConfContentAGCWorker = fs.readFileSync(kubeConfAGCWorker, {encoding: 'utf8'});

      let deploymentConfAGCWorker = YAML.parse(kubeConfContentAGCWorker);

      let initContainersAGCWorker = deploymentConfAGCWorker.spec.template.spec.initContainers;
      initContainersAGCWorker.forEach((value, index) => {
        if (value) {
          if (value.name === 'blockchain-src-container') {
            initContainersAGCWorker[index].image = dockerConfig.imageName;
          }
        }
      });

      let formattedYAMLStringAGCWorker = sanitizeYAML(YAML.stringify(deploymentConfAGCWorker, Infinity, 2));
      fs.writeFileSync(kubeConfAGCWorker, formattedYAMLStringAGCWorker);

      let kubeConfAGCBroker = getAGCBrokerDeploymentDefPath(kubernetesDirPath);
      let kubeConfContentAGCBroker = fs.readFileSync(kubeConfAGCBroker, {encoding: 'utf8'});

      let deploymentConfAGCBroker = YAML.parse(kubeConfContentAGCBroker);

      let formattedYAMLStringAGCBroker = sanitizeYAML(YAML.stringify(deploymentConfAGCBroker, Infinity, 2));
      fs.writeFileSync(kubeConfAGCBroker, formattedYAMLStringAGCBroker);

      let ingressKubeFileName = 'agc-ingress.yaml';
      let agcWorkerDeploymentFileName = 'crypticle-worker-deployment.yaml';

      let deploySuccess = () => {
        successMessage(
          `The '${serviceName}' service was deployed successfully - You should be able to access it online ` +
          `once it has finished booting up. This can take a while depending on your platform.`
        );
        process.exit();
      };

      if (isUpdate) {
        try {
          execSync(`kubectl replace -f ${kubernetesDirPath}/${agcWorkerDeploymentFileName}`, {stdio: 'inherit'});
        } catch (err) {}

        deploySuccess();
      } else {
        let kubeFiles = fs.readdirSync(kubernetesDirPath);
        let serviceAndDeploymentKubeFiles = kubeFiles.filter((configFileName) => {
          return configFileName !== ingressKubeFileName && isYAMLFile(configFileName) && configFileName !== localPathStorageConfigFileName;
        });
        if (gke) {
          let gkeKubeFiles = fs.readdirSync(path.resolve(kubernetesDirPath, 'gke'));
          let gkeK8sfileSet = new Set(gkeKubeFiles);
          serviceAndDeploymentKubeFiles = serviceAndDeploymentKubeFiles.filter((configFileName) => {
            return !gkeK8sfileSet.has(configFileName);
          });
          let nginxMandatoryFile = 'ingress-nginx-mandatory.yaml';
          gkeKubeFiles.sort((a, b) => {
            if (a === nginxMandatoryFile) {
              return -1;
            }
            if (b === nginxMandatoryFile) {
              return 1;
            }
            return 0;
          });
          let gkeKubeFilePaths = gkeKubeFiles.map((configFileName) => {
            return path.join('gke', configFileName);
          });

          serviceAndDeploymentKubeFiles = serviceAndDeploymentKubeFiles.concat(gkeKubeFilePaths);

          execSync(
            'kubectl create clusterrolebinding cluster-admin-binding --clusterrole cluster-admin --user $(gcloud config get-value account)',
            {stdio: 'inherit'}
          );
        }
        // Create StorageClass first.
        serviceAndDeploymentKubeFiles.unshift(localPathStorageConfigFileName);
        serviceAndDeploymentKubeFiles.forEach((configFilePath) => {
          let absolutePath = path.resolve(kubernetesDirPath, configFilePath);
          execSync(`kubectl create -f ${absolutePath}`, {stdio: 'inherit'});
        });

        // Wait a few seconds before deploying ingress (due to a bug in some environments).
        setTimeout(() => {
          try {
            execSync(`kubectl create -f ${kubernetesDirPath}/${ingressKubeFileName}`, {stdio: 'inherit'});
            deploySuccess();
          } catch (err) {
            failedToDeploy(err);
          }
        }, 7000);
      }
    } catch (err) {
      failedToDeploy(err);
    }
  };

  let handleDockerVersionTagAndPushToDockerImageRepo = function (versionTag) {
    let dockerConfig = crypticleK8sConfig.docker;

    if (dockerConfig.auth) {
      let authParts = Buffer.from(dockerConfig.auth, 'base64').toString('utf8').split(':');
      dockerUsername = authParts[0];
      dockerPassword = authParts[1];
      performDeployment(dockerConfig, versionTag, dockerUsername, dockerPassword);
    } else {
      promptDockerAuthDetails((username, password) => {
        performDeployment(dockerConfig, versionTag, username, password);
      });
    }
  };

  let incrementVersion = function (versionString) {
    return versionString.replace(/[^.]$/, (match) => {
      return parseInt(match) + 1;
    });
  };

  let pushToDockerImageRepo = function () {
    let versionTagString = parseVersionTag(crypticleK8sConfig.docker.imageName).replace(/^:/, '');
    let nextVersionTag;
    if (versionTagString) {
      if (isUpdate) {
        nextVersionTag = incrementVersion(versionTagString);
        crypticleK8sConfig.docker.imageName = setImageVersionTag(crypticleK8sConfig.docker.imageName, nextVersionTag);
      } else {
        nextVersionTag = versionTagString;
      }
    } else {
      nextVersionTag = '""';
    }

    promptInput(`Enter the Docker version tag for this deployment (Default: ${nextVersionTag}):`, handleDockerVersionTagAndPushToDockerImageRepo);
  };

  if (crypticleK8sConfig.docker && crypticleK8sConfig.docker.imageRepo) {
    pushToDockerImageRepo();
  } else {
    let dockerImageName, dockerDefaultImageName, dockerDefaultImageVersionTag;

    let saveCrypticleK8sConfigs = function () {
      crypticleK8sConfig.docker = {
        imageRepo: 'https://index.docker.io/v1/',
        imageName: dockerImageName
      };
      if (saveDockerAuthDetails) {
        addAuthDetailsToCrypticleK8s(crypticleK8sConfig, dockerUsername, dockerPassword);
      }
      try {
        saveCrypticleK8sConfigFile(crypticleK8sConfig);
      } catch (err) {
        failedToDeploy(err);
      }
      pushToDockerImageRepo();
    };

    let handleDockerImageName = function (imageName) {
      if (imageName) {
        dockerImageName = imageName;
      } else {
        dockerImageName = setImageVersionTag(dockerDefaultImageName, dockerDefaultImageVersionTag);
      }
      saveCrypticleK8sConfigs();
    };

    let promptDockerImageName = function () {
      dockerDefaultImageName = `${dockerUsername}/${serviceName}`;
      dockerDefaultImageVersionTag = 'v1.0.0';

      promptInput(`Enter the Docker image name without the version tag (Or press enter for default: ${dockerDefaultImageName}):`, handleDockerImageName);
    };

    promptK8sTLSCredentials(() => {
      promptDockerAuthDetails(promptDockerImageName);
    });
  }
} else if (command === 'undeploy') {
  let projectPath = arg1 || '.';
  let absoluteProjectPath = path.resolve(projectPath);
  let serviceName = path.parse(absoluteProjectPath).base;

  let kubernetesDirPath = projectPath + '/kubernetes';
  let kubeFiles = fs.readdirSync(kubernetesDirPath).filter((fileName) => {
    return isYAMLFile(fileName);
  });
  kubeFiles.forEach((configFilePath) => {
    let absolutePath = path.resolve(kubernetesDirPath, configFilePath);
    try {
      execSync(`kubectl delete -f ${absolutePath}`, {stdio: 'inherit'});
    } catch (err) {}
  });

  try {
    execSync(
      'kubectl delete clusterrolebinding cluster-admin-binding',
      {stdio: 'inherit'}
    );
  } catch (err) {}

  successMessage(`The '${serviceName}' service was undeployed successfully.`);

  process.exit();
} else if (command === 'add-tls-secret') {
  let secretName = argv.s || DEFAULT_TLS_SECRET_NAME;
  let privateKeyPath = argv.k;
  let certFilePath = argv.c;

  if (privateKeyPath == null || certFilePath == null) {
    errorMessage(`Failed to upload secret. Both a key file path (-k) and a certificate file path (-c) must be provided.`);
  } else {
    let success = uploadTLSSecret(secretName, privateKeyPath, certFilePath, errorMessage);
    if (success) {
      successMessage(`The private key and cert pair were added to your cluster under the secret name "${secretName}".`);
    }
  }
  process.exit();
} else if (command === 'remove-tls-secret') {
  let secretName = argv.s || DEFAULT_TLS_SECRET_NAME;
  let success = removeTLSSecret(secretName, errorMessage);
  if (success) {
    successMessage(`The private key and cert pair under the secret name "${secretName}" were removed from your cluster.`);
  }
  process.exit();
} else {
  errorMessage(`"${command}" is not a valid Crypticle command.`);
  showCorrectUsage();
  process.exit();
}
