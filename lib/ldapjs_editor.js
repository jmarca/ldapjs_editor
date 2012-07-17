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
var ldap_host = env.LDAP_HOST || '127.0.0.1';
var ldap_port = env.LDAP_PORT || 1389;

function getClient(){
    return ldap.createClient({
        url: 'ldap://' + ldap_host + ':' +ldap_port
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

function _resetPassword(barePassword,next){
    if(_.isFunction(barePassword)){
        next = barePassword
        barePassword = crypto.randomBytes(24).toString('base64')
    }
    return ssha.ssha_pass(barePassword,function(err,hash){
               return next(err,hash,barePassword)
           });
}

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
                       client.unbind()
                       return next(new Error('Duplicate user name'+req.params.uid))
                   }else{
                       // an error in this case is good, means no conflict in db
                       // populate user object
                       var user = {'dn':dsn
                                  ,'objectClass':['top','person','inetOrgPerson']
                                  ,'controls':[]};
                       _resetPassword(function(err,hash,barePassword){
                           if(err){
                               console.log(err)
                               return next(err);
                           }
                           user.userpassword=hash;
                           user.uid=req.params.uid;
                           user.mail=req.params.mail
                           user.givenName=req.params.givenName;
                           user.sn=req.params.sn;
                           user.cn=[user.givenName,user.sn].join(' ');
                           return client.add(user.dn,user,function(err){
                                      client.unbind()
                                      next(err,user,barePassword)
                                      return null;
                                  });
                       });
                   }
            return null;
        });
    });
    return null;
}

function emailChangedPassword(err,user,barePassword,next){
    if(err) next(err)
    emailer.send_new_password_email(user
                                  ,barePassword
                                  ,function(err){
                                       next (err,user,barePassword);
                                       return null;
                                   });
    return null;
}
function emailNewUser(err,user,barePassword,next){
    if(err) next(err)
    emailer.send_new_account_email(user
                                  ,barePassword
                                  ,function(err){
                                       next (err,user,barePassword);
                                       return null;
                                   });
    return null;
}

function alertAdmin(err,user,next){
    if(err) next(err)
    emailer.send_account_created_alert(user
                                  ,function(err){
                                       next (err,user);
                                       return null;
                                   });
    return null;
}

// instead of editing the whole user, just edit each field
// individually and let it all be done via ajax calls
function handleNonPasswordFields(user,change,req,res,next){
    _.map(['uid','mail','givenName','sn']
         ,function(v){
              v = v.toLowerCase()
              if(req.params[v] !== undefined){

                  var mod = {};
                  mod[v]=req.params[v];
                  change.push(new ldap.Change({operation: 'replace',
                                               modification: mod
                                              }));
                  user[v] = req.params[v]
              }
              return null;
          });
    var mod = {'cn': [user.givenname,user.sn].join(' ')}
    change.push(new ldap.Change({operation: 'replace',
                                 modification: mod
                                }));
    _saveChange(user,change,next);
}

function handlePasswordField(user,change,req,res,next){
    console.log('in handle password field')
    // if password is changed, verify it first, then hash it
    var currentPassword = req.params.currentpassword;
    if(currentPassword === undefined){
        return next(new Error('Wrong value for current password.  Passowrd not changed'));
        //res.redirect(wrongPassword);
    }
    console.log(JSON.stringify(user))
    ssha.checkssha(currentPassword
                  ,user.userpassword
                  ,function(err,result){
                       if(err || ! result){
                           // maybe currentPassword is not an {SSHA} value?
                           if (user.userpassword.substr(0,6) != '{SSHA}' &&
                               user.userpassword == currentPassword ){
                               // okay to modify password saved in plaintext
                           }else{
                               return next(new Error('Wrong value for current password.  Passowrd not changed'));
                           }
                       }
                       ssha.ssha_pass(req.params.userpassword,function(err,hash){
                           if(err) return next(err);
                           _resetPassword(req.params.userpassword,function(err,hash,barePassword){
                               change.push(new ldap.Change({
                                   operation: 'replace',
                                   modification: {
                                       userpassword: hash
                                   }
                               }));
                               user.userpassword = hash;
                               handleNonPasswordFields(user,change,req,res,next);
                               return null;
                           })
                           return null;
                       })
                       return null;
                   });
    return null;
}


function resetPassword(req,res,next){
    loadUser(req,res,function(err,user){
        if(err) next(err);
        _resetPassword(function(err,hash,barePassword){
            if(err){
                console.log(err)
                return next(err);
            }
            user.userpassword=hash;
            var change = new ldap.Change({
                operation: 'replace',
                modification: {
                    userpassword: hash
                }
            });
            async.series([function(cb){
                              _saveChange(user,change,cb)
                          }
                         ,function(cb){
                              emailChangedPassword(null,user,barePassword,cb)
                          }]
                        ,function(err){
                             next(err,barePassword)
                         });
            return null;
        });
    });
}

function _saveChange(user,change,next){
    // possibly check here for a proper user object?
    var client = getClient();
    client.bind('cn=Manager',manager_password,function(err){
        if(err) next(err);
        var dsn = user.dn
        client.modify(dsn, change, function(err) {
            if(err){
                next(err);
            }
            next();
        });

    });
}

function editUser(req,res,next){
    loadUser(req,res,function(err,user){
        if(err) next(err);
        // stub
        var change = [];
        if(req.params.userpassword !== undefined){
            handlePasswordField(user,change,req,res,next);
        }else{
            handleNonPasswordFields(user,change,req,res,next);
        }
        return null;
    })
    return null;
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
            //console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
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
        var dsn = 'uid='+req.params.uid+',ou=people,dc=ctmlabs,dc=org';
        query(err,dsn,client,function(err,user){
            client.unbind()
            next(err,user)
        });
        return null;
    })
    return null;
}

function deleteUser(req,res,next){
    // first bind client

    var client = getClient();
    client.bind('cn=Manager',manager_password,function(err){
        if(err) next(err);
        var dsn = 'uid='+req.params.uid+',ou=people,dc=ctmlabs,dc=org';
        client.del(dsn,function(err){
            client.unbind()
            next(err)
        });
        return null;
    })
    return null;
}

function loadGroup(req,res,next){
    throw new Error('not implemented')
}

function addUserToGroup(req,res,next){
    throw new Error('not implemented')
}


exports.loadUser=loadUser;
exports.createNewUser=createNewUser;
exports.emailNewUser=emailNewUser;
exports.alertAdmin=alertAdmin;
exports.getClient=getClient;
exports.query=query;
exports.deleteUser=deleteUser;
exports.resetPassword=resetPassword;

exports.editUser=editUser;
