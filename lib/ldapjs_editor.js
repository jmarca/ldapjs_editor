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
var manager_dn = env.LDAP_DN;
var manager_password = env.LDAP_PASS;
var ldap_host = env.LDAP_HOST || '127.0.0.1';
var ldap_port = env.LDAP_PORT || 1389;


console.log('binding to: '+manager_dn + '  '
           +'ldap://' + ldap_host + ':' + ldap_port)

// to do, parameterize host and port so that I can set them at will
// but actually, that is only necessary for tests, so perhaps
// nevermind and doing so correctly would mean refactoring this whole
// thing into more of a wrapped object function thingee
function getClient(){
    return ldap.createClient({
        url: 'ldap://' + ldap_host + ':' + ldap_port
     });
}

function binder(client,cb){
    return client.bind(manager_dn,manager_password,cb)
};


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


/** createNewUser
 *
 * this function will create a new user.  It will also assign that
 * user to a group called newusers (creating that group if it doesn't
 * exist).  It returns the user account as well as the bare password.
 * It is up to the code using this function to decide whether to send
 * that information along to a send mail with the password, or whether
 * to just send an email saying that hte account creation is awaiting
 * administrative approval
 */
function createNewUser(req,res,next){
    // first bind client
    var client = getClient();
    binder(client,function(err){
        if(err){
            console.log(err);
            next(err);
        }
        // first prevent duplicate uid
        var dsn = getDSN(req.params)
        query(err,dsn,client,function(err,existing){
                   if(err === undefined || existing !== undefined) {

                       // collision
                       client.unbind()
                       return next(new Error('Duplicate user name'+req.params.uid))
                   }else{
                       var params = filterUserParams(req)
                       // an error in this case is good, means no conflict in db
                       // populate user object
                       var user = {'objectClass':['top','person','inetOrgPerson']
                                  //,'controls':[]
                                  };
                       _resetPassword(function(err,hash,barePassword){
                           if(err){
                               console.log(err)
                               return next(err);
                           }
                           user.userpassword=hash;
                           user.uid=params.uid;
                           user.mail=params.mail
                           user.givenname=params.givenname;
                           user.sn=params.sn;
                           user.cn=[user.givenname,user.sn].join(' ');
                           return client.add(dsn,user,function(err){
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

var group_parameters = ['uniquemember'
                       ,'cn'
                       ,'businesscategory'
                       ,'seealso'
                       ,'owner'
                       ,'ou'
                       ,'o'
                       ,'description']

function filterGroupParams(req){
    var mapping = {};
    var params = _.forEach(req.params
                          ,function(v,k){
                               var _k = k.toLowerCase()
                               if( _.indexOf(group_parameters
                                            ,_k
                                            ) !== -1 ){
                                   delete req.params[k]
                                   mapping[_k] = v
                               }
                           })
    req.params = _.extend(req.params,mapping);
    return req.params;
}
var user_parameters = ['userpassword','currentpassword','uid','mail','givenname','sn'];
function filterUserParams (req){
    var mapping = {};
    var params = _.forEach(req.params
                          ,function(v,k){
                               var _k = k.toLowerCase()
                               if( _.indexOf(user_parameters
                                            ,_k
                                            ) !== -1 ){
                                   delete req.params[k]
                                   mapping[_k] = v
                               }
                           })
    req.params = _.extend(req.params,mapping);
    return req.params;
}



// instead of editing the whole user, just edit each field
// individually and let it all be done via ajax calls
function handleNonPasswordFields(user,change,req,res,next){
    _.forEach(['uid','mail','givenname','sn']
             ,function(v){
                  if(req.params[v] !== undefined){

                      var mod = {};
                      mod[v]=req.params[v];
                      var op = 'replace'
                      if(user[v] === undefined){
                          op='add'
                      }

                      change.push(new ldap.Change({operation: op,
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
    _saveChange(getDSN(user),change,next);
}

function handlePasswordField(user,change,req,res,next){
    // if password is changed, verify it first, then hash it
    var currentPassword = req.params.currentpassword;
    if(currentPassword === undefined){
        return next(new Error('Wrong value for current password.  Passowrd not changed'));
        //res.redirect(wrongPassword);
    }

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
                              _saveChange(getDSN(user),change,cb)
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

function _saveChange(dsn,change,next){
    // possibly check here for a proper user object?
    var client = getClient();
    binder(client,function(err){
        if(err) next(err);
        client.modify(dsn, change, function(err) {
            if(err){
                next(err);
            }
            next();
        });

    });
}

function editUser(req,res,next){
    var params = filterUserParams(req);

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

function query (err,dsn,attributes,client,next){
    if(err){
        console.log(err);
        next(err)
    }
    if(next === undefined ){
        // attributes is a late addition to this api
        next=client
        client=attributes
        attributes = _userSearchAttributes({})
    }
    var output = [];
    client.search(dsn, {'scope':'sub', 'attributes':attributes}, function(err, res) {
        if(err) next(err);
        res.on('searchEntry', function(entry) {
            output.push(entry.object)
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
                if(output.length === 1) output = output[0]
                next(null,output);
            }
        });

    });
}

// borrow from node-ldapjs/lib/messages/search_response.js
function _lowercase_attributes(entry){
    var savedAttrs = {};
    _.forEach(entry
             ,function(v,k){
                  var _a = k.toLowerCase();
                  savedAttrs[_a] = v;
                  delete entry[k];
              });

    entry = _.extend(entry,savedAttrs)
    _.forEach(['uniquemember','memberof']
             ,function(k){
                  if(entry[k] !== undefined)
                      entry[k] = _.flatten([savedAttrs[k]])
              })
    return entry;
}

function getDSN(user){
    if(_.isObject(user) && user.uid !== undefined){
        return 'uid='+user.uid+',ou=people,dc=ctmlabs,dc=org';
    }
    return 'uid='+user+',ou=people,dc=ctmlabs,dc=org';

}

function getGroupDSN(group){
    if(_.isObject(group) && group.cn !== undefined){
        return 'cn='+group.cn+',ou=groups,dc=ctmlabs,dc=org';
    }
    return 'cn='+group+',ou=groups,dc=ctmlabs,dc=org';

}

function _groupSearchAttributes(req){
    return ['dn'
           ,'objectClass'
           ,'uniqueMember'
           ,'cn']
}

function _userSearchAttributes(req){
    var user_attrs = ['dn'
                     ,'objectclass'
                     ,'uid'
                     ,'givenname'
                     ,'sn'
                     ,'cn'
                     ,'mail'
                     ];
    if(req.params){
        if(req.params.memberof)
            user_attrs.push('memberof')
        if(req.params.userpassword)
            user_attrs.push('userpassword')
    }
    return user_attrs;
}

function loadUser(req,res,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) next(err);
        var dsn = getDSN(req.params.uid)
        var attributes = _userSearchAttributes(req)
        query(err,dsn,attributes,client,function(err,user){
            if(err) return next(err)
            client.unbind()
            // stupid camel case idiocy when case is not sensitive
            user = _lowercase_attributes(user)
            return next(err,user)
        });
        return null;
    })
    return null;
}

function loadGroup(req,res,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        var dsn = getGroupDSN(req.params)
        query(err,dsn,_groupSearchAttributes(),client,function(err,group){
            if(err) return next(err)
            client.unbind()
            // stupid camel case idiocy when case is not sensitive
            group = _lowercase_attributes(group)
            return next(err,group)
        });
        return null;
    })
    return null;
}

function loadUsers(req,res,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) next(err);
        var dsn = 'ou=people,dc=ctmlabs,dc=org';
        query(err,dsn,_userSearchAttributes({params:{'memberof':true}}),client,function(err,users){
            client.unbind()
            // stupid camel case idiocy when case is not sensitive
            // live with it for now?
            _.forEach(users
                     ,function(user){
                          user= _lowercase_attributes(user)
                      })
            next(err,users)
        });
        return null;
    })
    return null;
}

function loadGroups(req,res,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) next(err);
        var dsn = 'ou=groups,dc=ctmlabs,dc=org';
        query(err,dsn,_groupSearchAttributes(),client,function(err,groups){
            client.unbind()
            next(err,groups)
        });
        return null;
    })
    return null;
}

function deleteUser(req,res,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) next(err);
        var dsn = getDSN(req.params)
        client.del(dsn,function(err){
            client.unbind()
            if(err && err.name !== undefined && err.name=='NoSuchObjectError')
                return next();
            return next(err)
        });
        return null;
    })
    return null;
}

function deleteGroup(req,res,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) next(err);
        var dsn = getGroupDSN(req.params)
        client.del(dsn,function(err){
            client.unbind()
            if(err && err.name !== undefined && err.name=='NoSuchObjectError')
                return next();
            return next(err)
        });
        return null;
    })
    return null;
}
// super simple regex to test if something might be a dsn not a uid or cn

var dsn_regex = /,dc=ctmlabs,dc=org/;

function createGroup(req,res,next){
    // first bind client
    var client = getClient();
    binder(client,function(err){
        if(err){
            console.log(err);
            next(err);
        }
        // first prevent duplicate uid
        var dsn = getGroupDSN(req.params)
        query(err,dsn,['dn','cn'],client,function(err,existing){
                   if(err === undefined || existing !== undefined) {

                       // collision
                       client.unbind()
                       return next(new Error('Duplicate group name'+req.params.cn))
                   }else{
                       // an error in this case is good, means no conflict in db
                       // populate group object
                       var params = filterGroupParams(req)
                       var group = {"objectClass":["groupOfUniqueNames","top"]
                                   }
                       // the only real parameter of interest at the moment is uniquemember
                       _.forEach(group_parameters
                                ,function(k){
                                     if(req.params[k] !== undefined){
                                         var  v = req.params[k]
                                         if(k=='uniquemember'){
                                             group.uniquemember=
                                                 _.map(v
                                                      ,function(u){
                                                           if(dsn_regex.test(u)) return u
                                                           return getDSN(u)
                                                       })
                                         }else{
                                             group[k]=v
                                         }
                                     }
                                 })
                       return client.add(dsn
                                        ,group
                                        ,function(err){
                                             client.unbind()
                                             next(err,group)
                                             return null;
                                         });
                   }
        })
    });
    return null;
}

function addUserToGroup(req,res,next){
    function _autg (err,group){
        if(err) return next (err);
        var change = []
        group.uniquemember = _.flatten([group.uniquemember]) // handle non arrays
        _.forEach(req.params.newmembers
                 ,function(user){
                      if(!_.isObject(user)){
                          user = {uid:user}
                      }
                      group.uniquemember.push(getDSN(user))
                  })
        group.uniquemember = _.uniq(group.uniquemember)
        change.push(new ldap.Change({operation:'replace'
                                    ,modification:{'uniquemember':_.flatten([group.uniquemember])}
                                    }));
        _saveChange(getGroupDSN(group),change,function(err){
            if(err) return next(err)
            return loadGroup(req,res,next)
        });
        return null;
    }
    // load group, add users, save modified group
    loadGroup(req
             ,res
             ,function(err,group){
                  if(err){
                      if(err.name !== undefined
                       && err.name == 'NoSuchObjectError'
                       && req.params.create){
                          return createGroup(req,res,_autg)
                      }else{
                          return next(err)
                      }
                  }
                  return _autg(err,group)
              })
    return null;
}

function removeUserFromGroup(req,res,next){
    // load group, add users, save modified group
    loadGroup(req
             ,res
             ,function(err,group){
                  if(err){return next(err)}
                  var change = []
                  var drops = []
                  group.uniquemember = _.flatten([group.uniquemember]) // handle non arrays
                  _.forEach(req.params.dropmembers
                           ,function(user){
                                if(!_.isObject(user)){
                                    user = {uid:user}
                                }
                                drops.push(getDSN(user))
                            })
                  group.uniquemember = _.difference(group.uniquemember,drops)
                  if(_.isEmpty(group.uniquemember)){
                      return deleteGroup(req,res,next)
                  }
                  change.push(new ldap.Change({operation:'replace'
                                              ,modification:{'uniquemember':_.flatten([group.uniquemember])}
                                              }));
                  _saveChange(getGroupDSN(group),change,function(err){
                      if(err) return next(err)
                      return loadGroup(req,res,next)
                  });
                  return null;
              });
    return null;

}


exports.getDSN=getDSN;
exports.getGroupDSN=getGroupDSN;
exports.loadUser=loadUser;
exports.createNewUser=createNewUser;
exports.emailNewUser=emailNewUser;
exports.alertAdmin=alertAdmin;
exports.getClient=getClient;
exports.query=query;
exports.deleteUser=deleteUser;
exports.resetPassword=resetPassword;

exports.editUser=editUser;
exports.loadUsers=loadUsers;

exports.loadGroup=loadGroup;
exports.loadGroups=loadGroups;
exports.createGroup=createGroup;
exports.deleteGroup=deleteGroup;
exports.addUserToGroup=addUserToGroup;
exports.removeUserFromGroup=removeUserFromGroup;
