/* global require console process */

var env = process.env;
var mailer_user = env.MAILER_USER;
var mailer_password = env.MAILER_PASS;
var mailer_host = env.MAILER_HOST;

var nodemailer = require("nodemailer");

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
    host: mailer_host,
//    auth: {
//        user: mailer_user,
//        pass: mailer_password
//    },
    debug: true
});

// setup e-mail data with unicode symbols
var mailOptions = {
    from: "Sender Name ✔ <sender@example.com>", // sender address
    to: "jmarca@translab.its.uci.edu, james@activimetrics.com", // list of receivers
    subject: "Hello ✔", // Subject line
    text: "Hello world ✔ from nodemailer", // plaintext body
    html: "<b>Hello world ✔ from nodemailer</b>" // html body
}

// send mail with defined transport object
smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
        console.log(error);
    }else{
        console.log("Message sent: " + response.message);
    }

    // if you don't want to use this transport object anymore, uncomment following line
    //smtpTransport.close(); // shut down the connection pool, no more messages
});
