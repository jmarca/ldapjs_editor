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
    // setup e-mail data
    var mailOptions = {
        from: mailer_from, // sender address
        to: user.mail, //receiver
        cc: mailer_from, // sender cc
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
            //console.log("Message sent: " + response.message);
        }
        if(next) next(null)
    })
    return null;
}

function send_new_password_email(user, barePassword,next){
    // setup e-mail data
    var mailOptions = {
        from: mailer_from, // sender address
        to: user.mail, //receiver
        cc: mailer_from, // sender cc
        subject: "reset password, ctmlabs.net", // Subject line
        text: "Your account at ctmlabs.net has a new password.  "
              + "You might have requested this, or perhaps an administrative policy "
              + "has triggered a change in passwords.  "
              + "Go to http://www.ctmlabs.net and log in with the new password "+barePassword // plaintext body
    }

    // send mail with defined transport object
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
            next(error)
        }else{
            //console.log("Message sent: " + response.message);
        }
        if(next) next(null)
    })
    return null;
}
function send_account_created_alert(user,next){
    // setup e-mail data
    var mailOptions = {
        from: mailer_from, // sender address
        to: user.mail, //receiver
        cc: mailer_from, // sender cc
        subject: "new ctmlabs account for " + user.uid +  ':' + user.givenName, // Subject line
        text: 'A new account has been created with this email address at http://www.ctmlabs.net.  '
            + 'When the site administrators have approved the account, you will receive another '
            + 'email with the account password'
    }

    // send mail with defined transport object
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
            next(error)
        }else{
            //console.log("Message sent: " + response.message);
        }
        if(next) next(null)
    })
    return null;
}
exports.send_new_account_email=send_new_account_email;
exports.send_new_password_email=send_new_password_email;
exports.send_account_created_alert=send_account_created_alert;
