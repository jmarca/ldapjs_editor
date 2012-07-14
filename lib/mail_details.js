/* global require console process */

var env = process.env;
var mailer_user = env.MAILER_USER;
var mailer_password = env.MAILER_PASS;
var mailer_host = env.MAILER_HOST;
var mailer_from = env.MAILER_FROM;

var nodemailer = require("nodemailer");

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
    host: mailer_host
});


function send_new_account_email(user, barePassword,next){
    console.log(user + ' ' + barePassword)
    // setup e-mail data
    var mailOptions = {
        from: mailer_from, // sender address
        to: [user.email,mailer_from].join(', '), // receiver
        subject: "new ctmlabs account for " + user.uid +  ':' + user.givenName, // Subject line
        text: "A new account has been created with this email address at http://www.ctmlabs.net.  "
            + "Please go to http://www.ctmlabs.net/auth/cas and enter your username and password.  "
            + "The auto generated password is "+barePassword, // plaintext body
        html: '<p>A new account has been created with this email address at <a href="http://www.ctmlabs.net">CTMLabs</a>.  '
            + 'Please go to <a href="http://www.ctmlabs.net/auth/cas">http://www.ctmlabs.net/auth/cas</a> and enter your username and password.  '
            + 'The auto generated password is '+barePassword+' </p>' // html body
    }

    // send mail with defined transport object
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
            next(error)
        }else{
            console.log("Message sent: " + response.message);
        }
        next(null)
    })
    return null;
}
exports.send_new_account_email=send_new_account_email;
