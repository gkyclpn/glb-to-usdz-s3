require('dotenv').config()
const AWS = require('aws-sdk')
const fs = require('fs')
const { exec } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const path = require('path')

AWS.config.update({
    maxRetries: 3,
    httpOptions: {timeout: 30000, connectTimeout: 5000},
    region: 'eu-central-1',
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3()
convertFile(workerData.filename).then((outputPath) => {
    parentPort.postMessage({ success: true, outputPath: outputPath })
}).catch((error) => {
    parentPort.postMessage({ success: false, error: error })
});

async function convertFile(filename) {
    var params = {Bucket: process.env.AWS_S3_BUCKET_NAME, Key: filename};  
    const downloadPath = `./copyFiles/${filename}`

    let content = await (await s3.getObject(params).promise()).Body;
    if (content) {
        // Write file
        fs.writeFile(downloadPath, content, (err) => {
            if (err) { console.log(err); }
        });
    }
    else {
        throw "FileNotExist"
    }
    

    return new Promise((resolve, reject) => {
        const withoutExtensionName = path.parse(filename).name
        exec(`usd_from_gltf ${downloadPath} ./copyFiles/${withoutExtensionName + '.usdz'}`, async (error, stdout, stderr) => {
        if (error) {
            reject(error.message);
            return;
        }
        if (stderr) {
            reject(stderr);
            return;
        }
        const blob = fs.readFileSync(`./copyFiles/${withoutExtensionName + '.usdz'}`)
        const uploadedImage = await s3.upload({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: withoutExtensionName + '.usdz',
            Body: blob,
          }).promise()
          fs.unlinkSync(`./copyFiles/${withoutExtensionName + '.glb'}`)
          fs.unlinkSync(`./copyFiles/${withoutExtensionName + '.usdz'}`)
        resolve(uploadedImage);
        });
    })
}

