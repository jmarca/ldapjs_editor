/* global console require process*/

/**
 * Module dependencies.
 */

var ldap = require('ldapjs')
var _ = require('underscore')
var async = require('async')
var crypto = require('crypto')
var ssha = require('openldap_ssha')
var emailer = require('./mail_details')

var env = process.env;
var manager_password = env.LDAP_PASS;


function getClient(){
    return ldap.createClient({
        url: 'ldap://127.0.0.1:1389'
     });
}



// basic idea.  If the user is logged in, then the req has a uid and
// such.  The user editor is restricted then to editing just that
// user's information.

// if the user is not logged in, then this module needs to allow for
// the creation of content from a post.  the post will store the
// user's details, and then needs to mail an initial password to the
// user's email address.  use CAS functionality to generate a one-time
// login token.  Nah, just create a random password


// so first, the post handler.  Accept a form, fill out the ldap
// object, and create

function createNewUser(req,res,next){
    // first bind client
    var client = getClient();
    client.bind('cn=Manager',manager_password,function(err){
        if(err){
            console.log(err);
            next(err);
        }
        // first prevent duplicate uid
        var dsn = 'uid='+req.params.uid+',ou=people,dc=ctmlabs,dc=org';
        query(err,dsn,client,function(err,existing){
                   if(err === undefined || existing !== undefined) {
                       // collision
                       console.log('collision');
                       client.unbind()
                       return next(new Error('Duplicate user name'+req.params.uid))
                   }else{
                       console.log('no collision');
                       // an error in this case is good, means no conflict in db
                       // populate user object
                       var user = {'dn':dsn
                                  ,'objectClass':['top','person','inetOrgPerson']
                                  ,'controls':[]};
                       console.log('making user')
                       var barePassword = crypto.randomBytes(24).toString('base64')
                       return ssha.ssha_pass(barePassword,function(err,hash){
                                  if(err){
                                      console.log(err)
                                      return next(err);
                                  }
                                  user.userPassword=hash;
                                  user.uid=req.params.uid;
                                  user.mail=req.params.mail
                                  user.givenName=req.params.givenName;
                                  user.sn=req.params.sn;
                                  user.cn=[user.givenName,user.sn].join(' ');
                                  user.role='guest';
                                  console.log(user)
                                  return client.add(user.dn,user,function(err){
                                             client.unbind()
                                             if(err)next(err);
                                             emailer.send_new_account_email(user
                                                                   ,function(err){
                                                                        next (err,user);
                                                                        return null;
                                                                    });
                                             return null;
                                         });
                              });
                   }
               });
    });
    return null;
}

function editUser(req,res,next){
    // stub
    return next(new Error('editing users not yet implemented'));
}
function query (err,dsn,client,next){
    if(err){
        console.log(err);
        next(err)
    }
    var output;
    client.search(dsn, {'scope':'sub'}, function(err, res) {
        if(err) next(err);
        res.on('searchEntry', function(entry) {
            output = entry.object
        });
        res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            console.error('error: ' + err.message);
            next(err)
        });
        res.on('end', function(result) {
            if(output === undefined){
                next(new Error('Failed to find: ' + dsn));
            }else{
                next(null,output);
            }
        });

    });
}
function loadUser(req,res,next){
    // first bind client

    var client = getClient();
    client.bind('cn=Manager',manager_password,function(err){
        if(err) next(err);
        console.log('bind okay');
        var dsn = 'uid='+req.params.uid+',ou=people,dc=ctmlabs,dc=org';
        query(err,dsn,client,function(err,user){
            client.unbind()
            next(err,user)
        });
        return null;
    })
    return null;
}


exports.loadUser=loadUser;
exports.createNewUser=createNewUser;
//export.editUser=editUser;
