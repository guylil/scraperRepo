// Load the AWS SDK for Node.js
let AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'REGION'});
// Create an SQS service object
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

const queueURL = "SQS_SCRAPE_QUEUE";

const params = {
    AttributeNames: [ "All" ],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: [ "All" ],
    QueueUrl: queueURL,
    VisibilityTimeout: 20,
    WaitTimeSeconds: 0
};

function getProfiles() {
    return new Promise((resolve, reject) => {
        sqs.receiveMessage(params, function(error, data) {
            if (error) {
                reject(error)
            } else if (data.Messages) {
                resolve (data.Messages)
            }
        })
    })
}

function upload(keyName, bucketName, data) {
    console.log(`uploding ${keyName} to s3 - ${bucketName}`);
    const bucketPromise = new AWS.S3({apiVersion: '2006-03-01'}).createBucket({Bucket: bucketName}).promise();
    return new Promise(
        (resolve, reject) => {
            // Handle promise fulfilled/rejected states
            bucketPromise.then(
                function(data) {
                    // Create params for putObject call
                    const objectParams = {Bucket: bucketName, Key: keyName, Body: data};
                    // Create object upload promise
                    const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                    uploadPromise.then(
                        function(data) {
                            console.log("Successfully uploaded data to " + bucketName + "/" + keyName);
                            resolve();
                        });
                }).catch(
                function(err) {
                    console.error(err, err.stack);
                    reject();
                });
        }
    )
}

module.exports =  { getProfiles, upload };