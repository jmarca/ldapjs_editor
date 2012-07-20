var should = require('should')
var ctmldap = require('../lib/ldapjs_editor')
var ssha = require('openldap_ssha')

var express = require('express');

var request = require('supertest');
var async = require('async')
var _ = require('underscore')
var env = process.env;
var test_email = env.LDAP_USER_EMAIL;
var newusergroup = env.LDAP_NEW_USER_GROUP || 'newusers'

var delete_users = [
    'trouble'
                   ,'trouble2'
                   ,'trouble3'
                   ,'trouble4'
                   ,'more trouble'
                   ,'loooser'
                   ,'luser'
]
var delete_groups = [
    'losers'
                    ,'winters'
                    ,'summers'
                    ,'springs'
//                    ,newusergroup
]


// helper for testing without express


/**
* Return the value of param `name` when present or `defaultValue`.
*
* - Checks route placeholders, ex: _/user/:id_
* - Checks body params, ex: id=12, {"id":12}
* - Checks query string params, ex: ?id=12
*
* To utilize request bodies, `req.body`
* should be an object. This can be done by using
* the `connect.bodyParser()` middleware.
*
* @param {String} name
* @param {Mixed} defaultValue
* @return {String}
* @api public
*/

var get_param = function(name, defaultValue){
  var params = this.params || {};
  var body = this.body || {};
  var query = this.query || {};
  if (null != params[name] && params.hasOwnProperty(name)) return params[name];
  if (null != body[name]) return body[name];
  if (null != query[name]) return query[name];
  return defaultValue;
};



var _before = function(setupdone){
        if (!setupdone) setupdone = function(){ return null; };
        async.series([function(cb){
                          if(_.isEmpty(delete_groups)) return cb()
                          console.log('cleaning groups')
                          async.forEachSeries(delete_groups
                                         ,function(cn,cb2){
                                              ctmldap.deleteGroup({params:{cn:cn}}

                                                                ,function(err){
                                                                     if(err){
                                                                         if(err.name && err.name=='NoSuchObjectError'){
                                                                             // okay
                                                                             return cb2()
                                                                         }else{
                                                                             return cb2(err)
                                                                         }

                                                                     }
                                                                     return cb2();
                                                                 })
                                          }
                                             ,cb)
                          return null;
                      }
                     ,function(cb){
                          if(_.isEmpty(delete_users)) return cb()
                          console.log('cleaning users')
                          async.forEachSeries(delete_users
                                         ,function(uid,cb2){
                                              ctmldap.deleteUser({params:{'uid':uid}}

                                                                ,function(err){
                                                                     if(err){
                                                                         if(err.name && err.name=='NoSuchObjectError'){
                                                                             // okay
                                                                             return cb2()
                                                                         }else{
                                                                             return cb2(err)
                                                                         }

                                                                     }
                                                                     return cb2();
                                                                 })
                                          }
                                               ,cb)
                          return null;
                        }
                     ]
                      ,setupdone
                      )
    }

var erq = require('../node_modules/express/lib/request')
describe('openldap ldapjs_editor',function(){
    //before(_before)

    it('should load a known user',function(done){
        var req =  { __proto__: erq };

        req.params={'uid':'jmarca'}
        req.param('uid').should.equal('jmarca')

        ctmldap.loadUser(req
                        ,function(err,user){
                                  should.not.exist(err);
                                  should.exist(user);
                                  user.should.have.property('mail','jmarca@translab.its.uci.edu');
                                  user.should.not.have.property('userpassword')
                                  user.should.not.have.property('memberof')
                                  done()
                              });
    });
    it('should load a known user with group membership',function(done){
        var req =  { __proto__: erq };
        req.params={'uid':'jmarca','memberof':true}

        ctmldap.loadUser(req
                        ,function(err,user){
                                  should.not.exist(err);
                                  should.exist(user);
                                  user.should.have.property('mail','jmarca@translab.its.uci.edu');
                                  user.should.not.have.property('userpassword')
                                  user.should.have.property('memberof')
                                  user.memberof.should.be.an.instanceOf(Array)
                                  done()
                              });
    });
    it('should load a known user with password hash',function(done){
        var req =  { __proto__: erq };
        req.params={'uid':'jmarca','userpassword':true}

        ctmldap.loadUser(req
                        ,function(err,user){
                                  should.not.exist(err);
                                  should.exist(user);
                                  user.should.have.property('mail','jmarca@translab.its.uci.edu');
                                  user.should.have.property('userpassword')
                                  user.should.not.have.property('memberof')
                                  done()
                              });
    });
    it('should fail to modify to a chosen password with incorrect current password'
      ,function(don){
           var req =  { __proto__: erq };
           req.params={'uid':'jmarca','userpassword':true}
           req.params={'uid':'jmarca'}
           req.body={'userpassword':'poobah'
                    ,'currentpassword':'notit'
                    }

           ctmldap.editUser(req
                           ,function(err,barePassword){
                                should.exist(err)
                                should.not.exist(barePassword)
                                don()
                            });
       });

    it('should not create a duplicate entry',function(done){
           var req =  { __proto__: erq };
           req.params={'uid':'jmarca','userpassword':true}
        ctmldap.createNewUser(req
                              ,function(err,user){
            should.exist(err);
            should.not.exist(user);
            done()
        });
    });
    it('should create and delete a new entry',function(done){
        async.waterfall([//  function(cb){
        //     var req =  { __proto__: erq };
        // req.params={'uid':'trouble2'}

        //                       ctmldap.deleteUser(req
        //                                         ,function(err){
        //                                              if(err){ console.log('bad delete'+JSON.stringify(err)) }
        //                                              should.not.exist(err)
        //                                              cb(err)
        //                                          })
        //                   }
        //                  ,
            function(cb){
                var req =  { __proto__: erq };
                req.params={'uid':'trouble2'}
                req.body={'uid':'trouble2'
                         ,'mail':test_email
                         ,'givenname':'Studly'
                         ,'sn':'McDude'
                         }

                ctmldap.createNewUser(req
                                     ,function(err,user,barePassword){
                                          should.not.exist(err);
                                          should.exist(user);
                                          console.log('created user: ' + user)
                                          cb(err,user)
                                      })
            }
                        ,function(user,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'trouble2'}
                             ctmldap.deleteUser(req
                                               ,function(err){
                                                    if(err){ console.log('bad delete'+JSON.stringify(err)) }
                                                    should.not.exist(err)
                                                    cb(err)
                                                })
                         }
        ]
                       ,done
                       )

    });


    it('should create and delete a new entry with camel case',function(done){
        async.waterfall([function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'trouble'}
                             req.body={'uid':'trouble'
                                      ,'Mail':test_email
                                      ,'GivenName':'Studly'
                                      ,'SN':'McDude'
                                      }
                             ctmldap.createNewUser(req
                                                  ,function(err,user,barePassword){
                                                       should.not.exist(err);
                                                       should.exist(user);
                                                       cb(err,user,barePassword)
                                                   })
                         }
                        ,function(u,barePassword,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'trouble',memberof:1}
                             ctmldap.loadUser(req
                                             ,function(err,user){
                                                  should.not.exist(err)
                                                  should.exist(user)
                                                  user.should.have.property('memberof')
                                                  user.memberof.should.be.an.instanceOf(Array)
                                                  user.memberof.should.include(ctmldap.getGroupDSN(newusergroup))
                                                  cb(err,user,barePassword)
                                              })
                         }
                        ,function(u,bp,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'trouble',memberof:1}
                             ctmldap.deleteUser(req
                                               ,function(err){
                                                    should.not.exist(err)
                                                    cb(err)
                                                });
                         }]
                       ,function(err){
                            done(err);
                        });
        return null;
    });
    it('should create, login as, do a search, and delete a new entry with camel case',function(done){
        ;
        async.waterfall([function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'trouble3'}
                             req.body={'uid':'trouble3'
                                      ,'Mail':test_email
                                      ,'GivenName':'Studly'
                                      ,'SN':'McFly'
                                      }
                             ctmldap.createNewUser(req
                                                  ,function(err,user,barePassword){
                                                       should.not.exist(err);
                                                       should.exist(user);
                                                       cb(err,user,barePassword)
                                                   })
                         }
                        ,function(user,barePassword,cb){
                             // try to log in with the new account
                             var client = ctmldap.getClient();
                             client.bind(ctmldap.getDSN(user.uid)
                                        ,barePassword
                                        ,function(err){
                                             should.not.exist(err)
                                             var dsn = 'ou=people,dc=ctmlabs,dc=org';
                                             ctmldap.query(null,dsn,['cn','uid'],client,function(err,result){
                                                 should.not.exist(err)
                                                 should.exist(result)
                                                 client.unbind()
                                                 cb(err)
                                             });
                                         });
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'trouble3'}
                             ctmldap.deleteUser(req
                                               ,function(err){
                                                    should.not.exist(err)
                                                    cb(err)
                                                });
                         }
                        ]
                       ,function(err){
                            should.not.exist(err)
                            done()
                        });
        return null;
    });


    it('should create and modify a new entry',function(done){
        async.waterfall([function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'more trouble'}
                             req.body={'uid':'more trouble'
                                      ,'mail':test_email
                                      ,'givenName':'Bran'
                                      ,'sn':'McMuphin'
                                      }

                             ctmldap.createNewUser(req
                                                  ,function(err,user){
                                                       should.not.exist(err);
                                                       should.exist(user);
                                                       cb(err,user)
                                                   })
                         }
                        ,function(user,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'more trouble'}
                             ctmldap.resetPassword(req
                                                  ,function(err,barePassword){
                                                       should.not.exist(err)
                                                       should.exist(barePassword)
                                                       cb(err,barePassword)
                                                   })
                         }
                        ,function(pass,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'more trouble'
                                        ,'userpassword':true}
                             ctmldap.loadUser(req
                                             ,function(err,user){
                                                  should.not.exist(err)
                                                  user.should.have.property('userpassword')

                                                  ssha.checkssha(pass
                                                                ,user.userpassword
                                                                ,function(err,result){
                                                                     should.not.exist(err);
                                                                     should.exist(result);
                                                                     result.should.equal(true);
                                                                     cb(err,pass)
                                                                 })
                                              })
                         }
                        ,function(pass,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'more trouble'}
                             req.body={'uid':'more trouble'
                                      ,'mail':'farfalla@activimetrics.com'
                                      ,'sn':'McBouncy'
                                      }
                             ctmldap.editUser(req
                                             ,function(err){
                                                  should.not.exist(err)
                                                  cb(err,pass)
                                              })
                         }
                        ,function(pass,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'more trouble'}
                             ctmldap.loadUser(req
                                             ,function(err,user){
                                                  should.not.exist(err)
                                                  user.mail.should.equal('farfalla@activimetrics.com')
                                                  user.sn.should.equal('McBouncy')
                                                  user.cn.should.equal('Bran McBouncy')
                                                  cb(err,pass)
                                              });
                         }
                        ,function(pass,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'more trouble'}
                             req.body={'uid':'more trouble'
                                      ,'mail':'baka@activimetrics.com'
                                      ,'sn':'McBlighty'
                                      ,'userPassword':'smeagol'
                                      ,'currentPassword':pass
                                      }
                             ctmldap.editUser(req
                                             ,function(err){
                                                  should.not.exist(err)
                                                  cb(err)
                                              })
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'more trouble'
                                        ,'userpassword':true}
                             ctmldap.loadUser(req
                                             ,function(err,user){
                                                  should.not.exist(err)
                                                  user.mail.should.equal('baka@activimetrics.com')
                                                  user.sn.should.equal('McBlighty')
                                                  user.cn.should.equal('Bran McBlighty')
                                                  ssha.checkssha('smeagol'
                                                                ,user.userpassword
                                                                ,function(err,result){
                                                                     should.not.exist(err);
                                                                     should.exist(result);
                                                                     result.should.equal(true);
                                                                     cb()
                                                                 })
                                              });
                         }]
                       ,function(e){
                            var req =  { __proto__: erq };
                            req.params={'uid':'more trouble'}

                            ctmldap.deleteUser(req
                                              ,function(err){
                                                   should.not.exist(err)
                                                   done(e)
                                               });

                        })
    })

    it('should get a list of all users',function(done){
        ctmldap.loadUsers(null,function(err,users){
            should.not.exist(err)
            should.exist(users)
            // need a better test here for making sure I got a proper list of users
            users.length.should.be.above(45)
            users[2].should.have.property('memberof')
            users[2].memberof.should.be.an.instanceOf(Array)
            done()
        });
    })

    it('should get a list of all groups',function(done){
        ctmldap.loadGroups(null,function(err,groups){
            should.not.exist(err)
            should.exist(groups)
            // need a better test here for making sure I got a proper list of groups
            groups.length.should.be.above(5)
            done()
        });
    })

    it('should get a known group',function(done){
        ctmldap.loadGroup({params:{cn:'admin'}}

                         ,function(err,group){
                              should.not.exist(err)
                              should.exist(group)
                              group.should.have.property('uniquemember')
                              group.should.not.have.property('uniqueMember')
                              group.uniquemember.should.be.an.instanceOf(Array)
                              done()
                          });
    });

    it('should create a new group',function(done){

        async.waterfall([function(cb){
                             ctmldap.createNewUser({params:{uid:'luser'
                                                          ,'mail':test_email
                                                          ,'givenname':'Sloppy'
                                                          ,'sn':'McFly'}}

                                                  ,cb)
                         }
                        ,function(user,pass,cb){

                             ctmldap.createGroup({params:{cn:'losers'
                                                         ,uniquemember:[ctmldap.getDSN(user)]}}

                                                ,function(err,group){
                                                     should.not.exist(err)
                                                     should.exist(group)
                                                     group.uniquemember.should.include(ctmldap.getDSN({uid:'luser'}))
                                                     group.should.have.property('uniquemember')
                                                     group.uniquemember.should.be.an.instanceOf(Array)
                                                     group.uniquemember.should.have.length(1)
                                                     cb(null,user,group)
                                                 })
                         }
                        ,function(user,group,cb){
                             ctmldap.loadUser({params:{uid:'luser',memberof:1}}

                                             ,function(err,user_reload){
                                                  should.not.exist(err)
                                                  should.exist(user_reload)
                                                  user_reload.should.have.property('memberof')
                                                  user_reload.memberof.should.be.an.instanceOf(Array)
                                                  user_reload.memberof.should.include(ctmldap.getGroupDSN('losers'))
                                                  user_reload.memberof.should.include(ctmldap.getGroupDSN(newusergroup))
                                                  cb(null,user,group)
                                              })
                         }
                        ,function(user,group,cb){
                             ctmldap.deleteGroup({params:{cn:group.cn}}

                                                ,function(err){
                                                     should.not.exist(err)
                                                     cb(null,user)
                                                 });
                         }
                        ,function(user,cb){
                             ctmldap.deleteUser({params:{uid:user.uid}}

                                               ,function(e,r){ cb(e) })
                         }
                        ,function(cb){
                             ctmldap.loadGroup({params:{cn:newusergroup}}

                                              ,function(e,g){
                                                   if(g !== undefined){
                                                       g.uniquemember.should.not.include(ctmldap.getDSN('luser'))
                                                   }
                                                   cb();
                                               })
                         }
                        ,function(cb){
                             ctmldap.loadUser({params:{uid:'luser',memberof:1}}

                                             ,function(err,user){
                                                  should.exist(err)
                                                  should.not.exist(user)
                                                  cb()
                                              })
                         }
                        ]
                       ,function(err){
                            if(err){
                                console.log('waterfall error: '+JSON.stringify(err))
                                throw new Error(err)
                            }
                            done()
                        });

    });



    it('should add and remove users to a  group',function(done){

        async.waterfall([function(cb){
                             ctmldap.createNewUser({params:{uid:'loooser'
                                                          ,'mail':test_email
                                                          ,'givenname':'Sloppy'
                                                          ,'sn':'McFly'}}

                                                  ,cb)
                         }
                        ,function(user,pass,cb){

                             ctmldap.createGroup({params:{cn:'winters'
                                                         ,uniquemember:[ctmldap.getDSN(user)]}}

                                                ,function(err,group){
                                                     cb(null,user,group)
                                                 })
                         }
                        ,function(user,group,cb){
                             ctmldap.addUserToGroup({params:{cn:'winters'
                                                            ,uniquemember:['jmarca']}}

                                                   ,function(err,group){
                                                        if(err) console.log(JSON.stringify(err))
                                                        should.not.exist(err)
                                                        should.exist(group)
                                                        group.should.have.property('uniquemember')
                                                        group.uniquemember.should.be.an.instanceOf(Array)
                                                        group.uniquemember.should.include(ctmldap.getDSN({uid:'jmarca'}))
                                                        group.uniquemember.should.include(ctmldap.getDSN({uid:'loooser'}))
                                                        group.uniquemember.should.have.length(2)
                                                        return cb(null,user,group)
                                                    })
                         }
                        ,function(user,group,cb){
                             ctmldap.removeUserFromGroup({params:{cn:'winters'
                                                            ,dropmembers:['loooser']}}

                                                   ,function(err,group){
                                                        should.not.exist(err)
                                                        should.exist(group)
                                                        group.should.have.property('uniquemember')
                                                        group.uniquemember.should.be.an.instanceOf(Array)
                                                        group.uniquemember.should.have.length(1)
                                                        group.uniquemember.should.include(ctmldap.getDSN({uid:'jmarca'}))
                                                        group.uniquemember.should.not.include(ctmldap.getDSN({uid:'loooser'}))
                                                        return cb(null,user,group)
                                                    })
                         }
                        ,function(user,group,cb){
                             ctmldap.deleteGroup({params:{cn:group.cn}}

                                                ,function(err){
                                                     should.not.exist(err)
                                                     cb(null,user)
                                                 });
                         }
                        ,function(user,cb){
                             ctmldap.deleteUser({params:{uid:user.uid}}

                                               ,function(e,r){ cb(e) })
                         }]
                       ,function(err){
                            if(err){
                                console.log('waterfall error: '+JSON.stringify(err))
                                throw new Error(err)
                            }
                            done()
                        });

    });



    it('groups cannot be empty, right?',function(done){

        async.waterfall([function(cb){
                             ctmldap.createGroup({params:{cn:'summers'
                                                         ,uniquemember:['jmarca'
                                                                       ,'crindt']}}

                                                ,function(err,group){
                                                     should.not.exist(err)
                                                     should.exist(group)
                                                     group.should.have.property('uniquemember')
                                                     group.uniquemember.should.be.an.instanceOf(Array)
                                                     group.uniquemember.should.have.length(2)
                                                     cb(null,group)
                                                 })
                         }
                        ,function(group,cb){
                             ctmldap.removeUserFromGroup({params:{cn:'summers'
                                                                 ,dropmembers:['crindt']}}

                                                        ,function(err,group){
                                                             should.not.exist(err)
                                                             should.exist(group)
                                                             group.should.have.property('uniquemember')
                                                             group.uniquemember.should.be.an.instanceOf(Array)
                                                             return cb(null,group)
                                                    })
                         }
                        ,function(group,cb){
                             ctmldap.removeUserFromGroup({params:{cn:'summers'
                                                                 ,dropmembers:['jmarca']}}

                                                        ,function(err,group){
                                                             if(err) console.log('baka '+JSON.stringify(err))
                                                             should.not.exist(err)
                                                             should.not.exist(group)
                                                             return cb(null)
                                                    })
                         }
                        ,function(cb){
                             ctmldap.deleteGroup({params:{cn:'summers'}}

                                                ,function(err){
                                                     should.not.exist(err)
                                                     cb()
                                                 });
                         }]
                       ,function(err){
                            if(err){
                                console.log('waterfall error: '+JSON.stringify(err))
                                throw new Error(err)
                            }
                            done()
                        });

    });



    it('should create a group by assigning a member to it, even if it does not exist'
      ,function(done){
        async.waterfall([function(cb){
                             ctmldap.loadGroup({params:{cn:'springs'}}

                                                ,function(err,group){
                                                     should.exist(err)
                                                     should.not.exist(group)
                                                     cb()
                                                 })
                         }
                        ,function(cb){
                             ctmldap.addUserToGroup({params:{cn:'springs'
                                                            ,create:true
                                                            ,uniquemember:['jmarca']}}

                                                   ,function(err,group){
                                                        if(err) console.log('baka '+JSON.stringify(err))
                                                        should.not.exist(err)
                                                        should.exist(group)
                                                        group.should.have.property('uniquemember')
                                                        group.uniquemember.should.be.an.instanceOf(Array)
                                                        group.uniquemember.should.eql([ctmldap.getDSN('jmarca')])
                                                        return cb(null,group)
                                                    })
                         }
                        ,function(group,cb){
                             ctmldap.removeUserFromGroup({params:{cn:'springs'
                                                                 ,dropmembers:['jmarca']}}

                                                        ,function(err,group){
                                                             should.not.exist(err)
                                                             should.not.exist(group)
                                                             return cb(null)
                                                    })
                         }]
                       ,function(err){
                            if(err){
                                console.log('waterfall error: '+JSON.stringify(err))
                                throw new Error(err)
                            }
                            done()
                        });

    });

    it('should remove multiple group memberships upon deletion of an entry',function(done){
        async.waterfall([function(cb){
                             ctmldap.createNewUser({params:{'uid':'trouble4'
                                                           ,'mail':test_email
                                                           ,'givenname':'Flatly'
                                                           ,'sn':'Refusing'
                                                           }}

                                                  ,function(err,user){
                                                       if(err) console.log('gag1: '+JSON.stringify(err))
                                                       cb(err,user)
                                                   })
                         }
                        ,function(user,cb){
                             ctmldap.addUserToGroup({params:{cn:'falls'
                                                            ,create:true
                                                            ,uniquemember:[user.uid]}}

                                                   ,function(err){
                                                        if(err) console.log('gag2: '+JSON.stringify(err))
                                                        cb(err,user)
                                                    })
                         }
                        ,function(user,cb){
                             ctmldap.addUserToGroup({params:{cn:'weekends'
                                                            ,create:true
                                                            ,uniquemember:[user.uid]}}

                                                   ,function(err){
                                                        if(err) console.log('gag3: '+JSON.stringify(err))
                                                        cb(err,user)
                                                    })
                         }
                        ,function(user,cb){
                             ctmldap.deleteUser({params:{'uid':'trouble4'}}

                                               ,function(err){
                                                        if(err) console.log('gag4: '+JSON.stringify(err))
                                                        cb(err)
                                                })
                         }
                        ,function(cb){
                             ctmldap.loadGroup({params:{cn:'falls'}}

                                              ,function(err,group){
                                                   should.exist(err)
                                                   should.not.exist(group)
                                                   cb()
                                               }
                                              )
                         }]
                       ,function(err){
                            if(err) console.log('gag: '+JSON.stringify(err))
                            should.not.exist(err)
                            done()
                        })

    });


});

