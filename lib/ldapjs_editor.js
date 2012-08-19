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
var newusergroup = env.LDAP_NEW_USER_GROUP || 'newusers'
var manager_password = env.LDAP_PASS;
var ldap_host = env.LDAP_HOST || '127.0.0.1';
var ldap_port = env.LDAP_PORT || 1389;


console.log('binding to: '+manager_dn + '  '
           +'ldap://' + ldap_host + ':' + ldap_port)

function UnauthorizedError(msg) {
    var e = new Error(msg || 'Unauthorized');
    e.status = 401;
    return e;
}

function ForbiddenError(msg) {
    var e = new Error(msg || 'Forbidden');
    e.status = 403;
    return e;
}

function NotFoundError(msg) {
    var e = new Error(msg || 'Resource Not Found');
    e.status = 404;
    return e;
}

function UnknownError(msg) {
    var e = new Error(msg || 'An Unknown Error Occured');
    e.status = 500;
    return e;
}

// super simple regex to test if something might be a dsn not a uid or cn
var dsn_regex = /,dc=ctmlabs,dc=org/;

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
function createNewUser(req,next){
    // first bind client
    var client = getClient();
    binder(client,function(err){
        if(err){
            console.log(err);
            return next(err);
        }
        // first prevent duplicate uid
        var dsn = getDSN(req.param('uid'))
        query(err,dsn,_userSearchAttributes(req),_nullFilter(),client,function(err,existing){
                   if(err === undefined || existing !== undefined) {

                       // collision
                       client.unbind()
                       return next(new Error('Duplicate user name'+dsn))
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
                           var ug_req = req
                           ug_req.params = {}

                           async.waterfall([function(cb){
                                                client.add(dsn,user,function(err){
                                                    client.unbind()
                                                    cb(err,user,barePassword)
                                                })
                                            }
                                           ,function(user,barePassword,cb){
                                                ug_req.body={cn:newusergroup
                                                            ,create:true
                                                            ,uniquemember:[user.uid]
                                                            }
                                                addUserToGroup(ug_req
                                                              ,function(err,group){
                                                                  if(err) { 
                                                                      console.log(JSON.stringify(err))
                                                                      next(err)
                                                                  }
                                                                  return cb(err,user,barePassword)
                                                               })
                                            }]
                                          ,function(err,user,barePassword){
                                               if(err) console.log(JSON.stringify(err))
                                            return next(err,user,barePassword)
                                        });
                           return null;
                       });
                   }
            return null;
        });
    });
    return null;
}

function emailChangedPassword(err,user,barePassword,next){
    if(err) return next(err)
    emailer.send_new_password_email(user
                                  ,barePassword
                                  ,function(err){
                                       next (err,user,barePassword);
                                       return null;
                                   });
    return null;
}
function emailNewUser(err,user,barePassword,next){
    if(err) return next(err)
    emailer.send_new_account_email(user
                                  ,barePassword
                                  ,function(err){
                                       next (err,user,barePassword);
                                       return null;
                                   });
    return null;
}

function alertAdmin(err,user,next){
    if(err) return next(err)
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

var user_parameters = ['userpassword'
                      ,'currentpassword'
                      ,'uid'
                      ,'mail'
                      ,'givenname'
                      ,'sn'
                      ,'memberof'];

function filterGroupParams(req){
    var mapping = {};
    var body = _.forEach(req.body
                          ,function(v,k){
                               var _k = k.toLowerCase()
                               if( _.indexOf(group_parameters
                                            ,_k
                                            ) !== -1 ){
                                   //delete req.body[k]
                                   mapping[_k] = v
                               }
                           })
    req.body = _.extend(req.body,mapping);
    return req.body;
}
// // borrow from node-ldapjs/lib/messages/search_response.js
// function _lowercase_attributes(entry){
//     var savedAttrs = {};
//     _.forEach(entry
//              ,function(v,k){
//                   var _a = k.toLowerCase();
//                   savedAttrs[_a] = v;
//                   delete entry[k];
//               });

//     entry = _.extend(entry,savedAttrs)
//     _.forEach(['uniquemember','memberof']
//              ,function(k){
//                   if(entry[k] !== undefined)
//                       entry[k] = _.flatten([savedAttrs[k]])
//               })
//     return entry;
// }
function lcGroupProperties(group){
    var mapping = {};
    var body = _.forEach(group
                        ,function(v,k){
                             var _k = k.toLowerCase()
                             if( _.indexOf(group_parameters
                                          ,_k
                                          ) !== -1 ){
                                 delete group[k]
                                 mapping[_k] = v
                                 if(_k == 'uniquemember') mapping[_k]=_.flatten([v])
                             }
                         })
    group = _.extend(group,mapping);
    return group;
}

function filterUserParams (req){
    var mapping = {};
    var body = _.forEach(req.body
                          ,function(v,k){
                               var _k = k.toLowerCase()
                               if( _.indexOf(user_parameters
                                            ,_k
                                            ) !== -1 ){
                                   //delete req.body[k]
                                   mapping[_k] = v
                               }
                           })
    req.body = _.extend(req.body,mapping)
    return req.body
}
function lcUserProperties(user){
    var mapping = {};
    var body = _.forEach(user
                        ,function(v,k){
                             var _k = k.toLowerCase()
                             if( _.indexOf(user_parameters
                                          ,_k
                                          ) !== -1 ){
                                 delete user[k]
                                 mapping[_k] = v
                                 if(_k == 'memberof') mapping[_k]=_.flatten([v])
                             }
                         })
    user = _.extend(user,mapping)
    return user
}



// instead of editing the whole user, just edit each field
// individually and let it all be done via ajax calls
function handleNonPasswordFields(user,change,req,next){
    _.forEach(['uid','mail','givenname','sn']
             ,function(v){
                  if(req.param(v) !== undefined){

                      var mod = {};
                      mod[v]=req.param(v);
                      var op = 'replace'
                      if(user[v] === undefined){
                          op='add'
                      }
                      // handle case when update is blank (i.e., delete field
                      if(mod[v] === '' || mod[v] === undefined){
                          op='delete'
                          // mod has to equal existing.  note, this may break if
                          // an attribute is allowed multiple times
                          mod[v]=group[v];
                      }

                      change.push(new ldap.Change({operation: op,
                                                   modification: mod
                                                  }));
                      user[v] = req.param(v)
                  }
                  return null;
              });
    var mod = {'cn': [user.givenname,user.sn].join(' ')}
    change.push(new ldap.Change({operation: 'replace',
                                 modification: mod
                                }));
    _saveChange(getDSN(user),change,next);
}

function handlePasswordField(user,change,req,next){
    // if password is changed, verify it first, then hash it
    var currentPassword = req.param('currentpassword');
    if(currentPassword === undefined){
        return next(new ForbiddenError('Wrong value for current password.  Password not changed'));
    }
    console.log("****** UPDATING PASSWORD FOR "+user.uid+"with params ["+[currentPassword,user.userpassword].join(",")+"]");

    ssha.checkssha(currentPassword
                  ,user.userpassword
                  ,function(err,result){
                      console.log("****** UPDATING PASSWORD 2 FOR "+user.uid);
                       if(err || ! result){
                           // maybe currentPassword is not an {SSHA} value?
                           console.log("**************************");
                           console.dir(err);
                           console.dir(result);
                           console.log("USERPASSWORD: "+user.userpassword);
                           console.log("currentPassword: "+currentPassword);
                           if (user.userpassword.substr(0,6) != '{SSHA}' &&
                               user.userpassword == currentPassword ){
                               // okay to modify password saved in plaintext
                           }else{
                               console.log("****** WRONG CURRENT PASSWORD FOR "+user.uid);

                               return next(new ForbiddenError('Wrong value for current password.  Password not changed'));
                           }
                       }
                       ssha.ssha_pass(req.param('userpassword'),function(err,hash){
                           console.log("****** UPDATING PASSWORD 3 FOR "+user.uid);
                           if (err) return next(err);
                           _resetPassword(req.param('userpassword'),function(err,hash,barePassword){
                               change.push(new ldap.Change({
                                   operation: 'replace',
                                   modification: {
                                       userpassword: hash
                                   }
                               }));
                               user.userpassword = hash;
                               console.log("****** REALLY UPDATING PASSWORD FOR "+user.uid);
                               handleNonPasswordFields(user,change,req,next);
                               return null;
                           })
                           return null;
                       })
                       return null;
                   });
    return null;
}

// should handle the case that a user is a user or a username

function resetPassword(req,next){
    loadUser(req,function(err,user){
        if(err) return next(err);
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
        return null
    });
}

function _saveChange(dsn,change,next){
    // possibly check here for a proper user object?
    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        client.modify(dsn, change, function(err) {
            if(err){
                return next(err);
            }
            return next();
        });
        return null
    });
}

function editUser(req,next){
    var params = filterUserParams(req);

    loadUser(req,function(err,user){
        if(err) return next(err);
        // stub
        var change = [];
        if(req.param('userpassword') !== undefined){
            handlePasswordField(user,change,req,next);
        }else{
            handleNonPasswordFields(user,change,req,next);
        }
        return null;
    })
    return null;
}

function query (err,dsn,attributes,filter,client,next){
    if(err){
        console.log(err);
        return next(err)
    }
    if(next === undefined ){
        // attributes is a late addition to this api
        next=client
        client=attributes
        attributes = _userSearchAttributes({})
    }
    var output = [];
    client.search(dsn, {'scope':'sub', 'attributes':attributes, 'filter':filter}, function(err, res) {
        if(err) return next(err);
        res.on('searchEntry', function(entry) {
            output.push(entry.object)
        });
        res.on('searchReference', function(referral) {
            //console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            return next(err)
        });
        res.on('end', function(result) {
            if(output === undefined){
                next(new NotFoundError('Failed to find: ' + dsn));
            }else{
                if(output.length === 1){
                    output = output[0]
                }
                next(null,output);
            }
        });
        return null
    });
}

var orgstring = 'ou=people,dc=ctmlabs,dc=org'
function getDSN(user){
    if(_.isObject(user) ){
        if(user.dsn && dsn_regex.test(user.dsn)){
            return user.dsn;
        }else if(user.uid !== undefined){
            return 'uid='+user.uid+',' + orgstring
        }
    }else if(dsn_regex.test(user)){
        return user
    }
    return 'uid='+user+',' + orgstring
}

function getGroupDSN(group){
    if(_.isObject(group) ){
        if(group.dsn && dsn_regex.test(group.dsn)){
            return group.dsn;
        }else if(group.cn !== undefined){
            return 'cn='+group.cn+',ou=groups,dc=ctmlabs,dc=org';
        }
    }else if(dsn_regex.test(group)){
        return group
    }
    return 'cn='+group+',ou=groups,dc=ctmlabs,dc=org';

}

function _groupSearchAttributes(req){
    return ['dn'
           ,'objectClass'
           ,'uniqueMember'
           ,'cn'
           ,'description']
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
    if(req.param){
        if(req.param('memberof'))
            user_attrs.push('memberof')
        if(req.param('userpassword'))
            user_attrs.push('userpassword')
    }
    return user_attrs;
}

function _nullFilter() { return '(objectClass=*)'; }

// loading user by email, not by username
// expect an array returned, because there is nothing in the ldap spec that
// enforces a unique emails per account.  that is, one email address may resolve to
// multiple accounts.  Use case, an admin with a user account and an admin account, or
// two people sharing an email account, or one person with multiple accounts
//
function loadUserByEmail(req,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        var dsn = orgstring;
        query(err,dsn,_userSearchAttributes(req),'(&(objectClass=Person)(mail='+req.param('mail')+'))',client,function(err,users){
            client.unbind()
            // users might be a singleton, might be a multiple.  make it an array
            users = _.flatten([users])
            // stupid camel case idiocy when case is not sensitive
            users = _.map(users
                     ,function(user){
                          return lcUserProperties(user)
                      })
            next(err,users)
        });
        return null;
    })
    return null;
}
function loadUser(req,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        var dsn = getDSN(req.param('uid'))
        var attributes = _userSearchAttributes(req)
        query(err,dsn,attributes,_nullFilter(),client,function(err,user){
            if(err) return next(err)
            client.unbind()
            // stupid camel case idiocy when case is not sensitive
            user = lcUserProperties(user)
            return next(err,user)
        });
        return null;
    })
    return null;
}


// instead of editing the whole group, just edit each field
// individually and let it all be done via ajax calls
function handleGroupMod(group,change,req,next){
    _.forEach(['description']
             ,function(v){
                  if(req.param(v) !== undefined){

                      var mod = {};
                      mod[v]=req.param(v);
                      var op = 'replace'
                      if(group[v] === undefined){
                          op='add'
                      }
                      // handle case when update is blank
                      if(mod[v] === '' || mod[v] === undefined){
                          op="delete";
                          // mod has to equal existing.  note, this may break if
                          // an attribute is allowed multiple times
                          mod[v]=group[v];
                      }

                      change.push(new ldap.Change({operation: op,
                                                   modification: mod
                                                  }));
                      group[v] = req.param(v)
                  }
                  return null;
              });
    _saveChange(getGroupDSN(group),change,next);
}


// allow modifications of groups (basically, the description field)
function editGroup(req,next){
    var params = filterGroupParams(req)
    loadGroup(req,function(err,group){
        if(err) return next(err);
        // stub
        var change = [];
        handleGroupMod(group,change,req,next);
        return null;
    })
    return null;
}

function loadGroup(req,next){
    // first bind client
    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        var cn = req.param === undefined ? req.params.dsn : req.param('cn')
        var dsn = getGroupDSN(cn)
        query(err,dsn,_groupSearchAttributes(),_nullFilter(),client,function(err,group){
            if(err) return next(err)
            client.unbind()
            // stupid camel case idiocy when case is not sensitive
            group = lcGroupProperties(group)
            return next(err,group)
        });
        return null;
    })
    return null;
}

function loadUsers(req,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        var dsn = orgstring;
        if(req.params === undefined) req.params={}
        req.params.memberof=true
        query(err,dsn,_userSearchAttributes(req),'(objectClass=Person)',client,function(err,users){
            client.unbind()
            // stupid camel case idiocy when case is not sensitive
            users = _.map(users
                     ,function(user){
                          return lcUserProperties(user)
                      })
            next(err,users)
        });
        return null;
    })
    return null;
}

function loadGroups(req,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        var dsn = 'ou=groups,dc=ctmlabs,dc=org';
        query(err,dsn,_groupSearchAttributes(),'(objectClass=groupofuniquenames)',client,function(err,groups){
            client.unbind()
            // stupid camel case idiocy when case is not sensitive
            groups = _.map(groups
                     ,function(group){
                          return lcGroupProperties(group)
                      })
            next(err,groups)
        });
        return null;
    })
    return null;
}

function deleteUser(req,next){
    //
    // have to delete and remove membership
    //
    // what will do the work is this function
    //
    function _deleteUser(next){
        var client = getClient();
        binder(client,function(err){
            if(err) return next(err);
            var dsn = getDSN(req.param('uid'))
            client.del(dsn,function(err){
                client.unbind()
                if(err && err.name !== undefined && err.name==='NoSuchObjectError')
                    return next();
                return next(err)
            });
            return null;
        })
        return null;
    }

    // but first, need to load the user to get the user's memberships
    async.waterfall([function(cb){
                         if(!req.param('memberof')){
                             if(req.params === undefined) req.params = {};
                             req.params.memberof=true
                         }
                         loadUser(req
                                 ,function(e,u){
                                      cb(e,u)
                                  })

                     }
                    ,function(user,cb){
                         // generate functions to remove user from groups
                         var groups = user.memberof;
                         var funcs = [];
                         if(!_.isEmpty(groups)){
                             funcs = _.map(groups
                                          ,function(g){
                                               return function(callback){
                                                   removeUserFromGroup({params:{dsn:g
                                                                               ,dropmember:[user.uid]}}
                                                                      ,callback)
                                               }
                                           });
                         }
                         funcs.push(_deleteUser)
                         // delete user and remove memberships
                         async.parallel(funcs,cb);
                     }]
                   ,function(err){
                        return next(err)
                    })
    return null;
}

function deleteGroup(req,next){
    // first bind client

    var client = getClient();
    binder(client,function(err){
        if(err) return next(err);
        var cn = req.param === undefined ? req.params.cn : req.param('cn')
        if(cn === undefined) cn = req.params.dsn
        var dsn = getGroupDSN(cn)
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

function createGroup(req,next){
    // first bind client
    var client = getClient();
    binder(client,function(err){
        if(err){
            console.log(err);
            return next(err);
        }
        // first prevent duplicate uid
        var cn = req.param === undefined ? req.params.cn : req.param('cn')
        var dsn = getGroupDSN(cn)
        query(err,dsn,['dn','cn'],_nullFilter(),client,function(err,existing){
                   if(err === undefined || existing !== undefined) {

                       // collision
                       client.unbind()
                       return next(new Error('Duplicate group name'+cn))
                   }else{
                       // an error in this case is good, means no conflict in db
                       // populate group object
                       var params = filterGroupParams(req)
                       var group = {"objectClass":["groupOfUniqueNames","top"]
                                   }
                       // the only real parameter of interest at the moment is uniquemember
                       _.forEach(group_parameters
                                ,function(k){
                                     if(req.param(k) !== undefined){
                                         var  v = req.param(k)
                                         if(k=='uniquemember'){
                                             v = _.flatten([v])
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
        return null
    });
    return null
}

function addUserToGroup(req,next){
    function _autg (err,group){
        if(err) return next (err);
        var change = []
        var newmembers = _.flatten([req.param('uniquemember')])
        group.uniquemember = _.flatten([group.uniquemember]) // handle non arrays
        _.forEach(newmembers
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
            return loadGroup(req,next)
        });
        return null;
    }
    // load group, add users, save modified group
    loadGroup(req
             ,function(err,group){
                  if(err){
                      if(err.name !== undefined
                       && err.name == 'NoSuchObjectError'
                       && req.param('create') !== undefined ){
                          return createGroup(req,_autg)
                      }else{
                          return next(err)
                      }
                  }
                  return _autg(err,group)
              })
    return null;
}

function removeUserFromGroup(req,next){
    // load group, remove users, save modified group
    loadGroup(req
             ,function(err,group){
                  if(err){return next(err)}
                  var change = []
                  var drops = []
                  var dropmember = req.param === undefined ? req.params.dropmember
                                  :req.param('dropmember')
                  dropmember = _.flatten([dropmember])
                  group.uniquemember = _.flatten([group.uniquemember]) // handle non arrays

                  _.forEach(dropmember
                           ,function(user){
                                if(!_.isObject(user)){
                                    user = {uid:user}
                                }
                                drops.push(getDSN(user))
                            })
                 console.log("REMOVING USER(s) "+drops.join(",")+" FROM GROUP "+group.cn);

                  group.uniquemember = _.difference(group.uniquemember,drops)
                  if(_.isEmpty(group.uniquemember)){
                      return deleteGroup(req,next)
                  }
                  change.push(new ldap.Change({operation:'replace'
                                              ,modification:{'uniquemember':_.flatten([group.uniquemember])}
                                              }));
                  _saveChange(getGroupDSN(group),change,function(err){
                      if(err) return next(err)
                      return loadGroup(req,next)
                  });
                  return null;
              });
    return null;

}


exports.getDSN=getDSN;
exports.getGroupDSN=getGroupDSN;
exports.loadUser=loadUser;
exports.loadUserByEmail=loadUserByEmail;
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
exports.editGroup=editGroup;
