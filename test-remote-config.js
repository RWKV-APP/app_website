const { RemoteConfigService } = require('./backend/dist/remote-config/remote-config.service');
const axios = require('axios');

async function run() {
  const dummyPrisma = {
    remoteConfig: {
      findFirst: async () => null,
      findUnique: async () => null,
    }
  };

  const service = new RemoteConfigService(dummyPrisma);

  try {
    const response = await axios.get('http://127.0.0.1:3462/get-demo-config');
    const demoConfig = response.data.data;
    if (!demoConfig || !demoConfig.chat || !demoConfig.chat.model_config || demoConfig.chat.model_config.length === 0) {
      throw new Error('No models found in demo config');
    }

    const model = demoConfig.chat.model_config[0];
    const originalSize = model.fileSize;
    const originalDate = model.date;

    // 1. Success case
    const successConfig = {
      chat: {
        model_config: [{
          ...model,
          fileSize: 1234, // Wrong size
          date: 1000000000, // Wrong date
        }]
      }
    };

    const result = await service['parseUpload']({
      fileName: 'latest.json',
      content: JSON.stringify(successConfig)
    });
    
    const parsedResult = result.parsed;
    const updatedModel = parsedResult.chat.model_config[0];
    const syncedSize = updatedModel.fileSize;
    const syncedDate = updatedModel.date;

    const check1Passed = syncedSize !== 1234 && syncedDate !== 1000000000;

    // 2. Failure case
    const failureConfig = {
      chat: {
        model_config: [{
          ...model,
          url: model.url.replace(/\/[^/]+$/, '/definitely-missing-file-123.bin')
        }]
      }
    };

    let check2Passed = false;
    let rejectionMessage = '';
    try {
      await service['parseUpload']({
        fileName: 'latest.json',
        content: JSON.stringify(failureConfig)
      });
    } catch (e) {
      rejectionMessage = e.message;
      // Blocking messages are often in warnings or thrown as errors.
      // Based on service code, it may push to warnings.
      check2Passed = true;
    }

    console.log(JSON.stringify({
      check1Passed,
      syncedSize,
      originalSize,
      syncedDate,
      originalDate,
      check2Passed,
      rejectionMessage
    }, null, 2));

  } catch (error) {
    console.error('Test script failed:', error.message);
    process.exit(1);
  }
}

run();
