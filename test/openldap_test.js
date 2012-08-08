var should = require('should')
var ctmldap = require('../lib/ldapjs_editor')
var ssha = require('openldap_ssha')

var EventEmitter = require('events').EventEmitter;
var express = require('express');
var erq = require('../node_modules/express/lib/request')

var request = require('supertest');
var async = require('async')
var _ = require('underscore')
var env = process.env;
var test_email = env.LDAP_USER_EMAIL;
var newusergroup = env.LDAP_NEW_USER_GROUP || 'newusers'

var manager_dn = env.LDAP_DN;
var manager_password = env.LDAP_PASS;

var delete_users = [
    'trouble'
                   ,'trouble2'
                   ,'trouble3'
                   ,'trouble4'
                   ,'more trouble'
                   ,'more bigger trouble'
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



var _before = function(setupdone){
        if (!setupdone) setupdone = function(){ return null; };
        async.series([function(cb){
                          if(_.isEmpty(delete_groups)) return cb()
                          console.log('cleaning groups')
                          async.forEachSeries(delete_groups
                                             ,function(cn,cb2){
                                                  var req =  { __proto__: erq };
                                                  req.params={'cn':cn}
                                                  ctmldap.deleteGroup(req
                                                                     ,function(err){
                                                                          if(err && err.name && err.name=='NoSuchObjectError'){
                                                                              return  cb2()
                                                                          }
                                                                          return cb2(err)
                                                                      });
                                              }
                                             ,cb)
                          return null;
                      }
                     ,function(cb){
                          if(_.isEmpty(delete_users)) return cb()
                          console.log('cleaning users')
                          async.forEachSeries(delete_users
                                             ,function(uid,cb2){
                                                  var req =  { __proto__: erq };
                                                  req.params={'uid':uid}
                                                  ctmldap.deleteUser(req
                                                                    ,function(err){
                                                                         if(err && err.name && err.name=='NoSuchObjectError'){
                                                                                 return cb2()
                                                                         }
                                                                         return cb2(err);
                                                                     })
                                              }
                                             ,cb)
                          return null;
                      }
                     ]
                    ,setupdone
                    )
    }

describe('getClient'
        ,function(){
             it('should get a client to use'
               ,function(done){
                    var client = ctmldap.getClient()
                    client.should.be.ok
                    client.should.be.instanceOf(EventEmitter)
                    //client.should.be.instanceOf(Client)
                    // duck type
                    client.should.have.property('connectTimeout')
                    client.should.have.property('host')
                    client.should.have.property('log')
                    client.should.have.property('port')
                    client.should.have.property('secure')
                    client.should.have.property('socketPath')
                    client.should.have.property('timeout')
                    client.should.have.property('url')
                    client.should.have.property('socket')
                    done()
                })
         })


describe('query'
                                  ,function(){
                       it('should allow arbitrary ldap queries'
      ,function(done){
      var client = ctmldap.getClient()
      client.bind(manager_dn,manager_password
                ,function(err){
                 should.not.exist(err)
                 var dsn = 'dc=ctmlabs,dc=org';
                 ctmldap.query(null,dsn,['dn','cn','objectclass'],'(objectclass=groupOfNames)',client,function(err,result){
                       should.not.exist(err)
                       should.exist(result)
                       result.should.be.instanceOf(Array)
                       result.should.be.empty
                       client.unbind()
                       done()
                   });
             })
  })
                   })

describe('openldap ldapjs_editor',function(){
    before(_before)
    it('should load a known user by a mail address',function(done){
        var req =  { __proto__: erq };

        req.params={'mail':'jmarca@translab.its.uci.edu'}

        ctmldap.loadUserByEmail(req
                        ,function(err,user){
                             should.not.exist(err);
                             should.exist(user);
                             user.should.be.an.instanceOf(Array)
                             _.each(user
                                   ,function(u){
                                        u.should.have.property('uid','jmarca')
                                        u.should.have.property('mail','jmarca@translab.its.uci.edu');
                                        u.should.not.have.property('userpassword')
                                        u.should.not.have.property('memberof')
                                    })
                             done()
                         });
    });
    it('should load a known user by a mail address v2',function(done){
        var req =  { __proto__: erq };

        req.params={'mail':'jmarca@translab.its.uci.edu'
                   ,'memberof':true}

        ctmldap.loadUserByEmail(req
                        ,function(err,user){
                             should.not.exist(err);
                             should.exist(user);
                             user.should.be.an.instanceOf(Array)
                             _.each(user
                                   ,function(u){
                                        u.should.have.property('uid','jmarca')
                                        u.should.have.property('mail','jmarca@translab.its.uci.edu');
                                        u.should.not.have.property('userpassword')
                                        u.should.have.property('memberof')
                                        u.memberof.should.be.an.instanceOf(Array)
                                    })
                             done()
                         });
    });


    it('should load a known user',function(done){
        var req =  { __proto__: erq };

        req.params={'uid':'jmarca'}
        req.param('uid').should.equal('jmarca')

        ctmldap.loadUser(req
                        ,function(err,user){
                             should.not.exist(err);
                             should.exist(user);
                             console.log(user)
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
                                            ctmldap.query(null,dsn,['cn','uid'],'(objectclass=*)',client,function(err,result){
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
        var req =  { __proto__: erq };
        ctmldap.loadUsers(req,function(err,users){
            should.not.exist(err)
            should.exist(users)
            // need a better test here for making sure I got a proper list of users
            users.length.should.be.above(env.LDAP_EXPECTED_MIN_USERS || 45)
            users[2].should.have.property('memberof')
            users[2].memberof.should.be.an.instanceOf(Array)

            // user list should only include Person objects
            _.each(users,function(user) {
                user.objectClass.should.include('person')
            })

            done()
        });
    })

    it('should get a list of all groups',function(done){
        var req =  { __proto__: erq };
        ctmldap.loadGroups(req,function(err,groups){
            should.not.exist(err)
            should.exist(groups)
            // need a better test here for making sure I got a proper list of groups
            groups.length.should.be.above(4)
            groups[2].should.have.property('uniquemember')
            groups[2].should.not.have.property('uniqueMember')

            // group list should only include GroupOfUniqueNames objects
            _.each(groups,function(group) {
                group.objectClass.should.include('groupOfUniqueNames')
            })

            done()
        });
    })

    it('should get a known group',function(done){
        var req =  { __proto__: erq };
        req.params={'cn':'admin'}
        ctmldap.loadGroup(req
                         ,function(err,group){
                              should.not.exist(err)
                              should.exist(group)
                              group.should.have.property('uniquemember')
                              group.should.not.have.property('uniqueMember')
                              group.uniquemember.should.be.an.instanceOf(Array)
                              done()
                          });
    });

    it('should create and modify a new group',function(done){
        async.waterfall([function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'luser'}
                             req.body={uid:'luser'
                                      ,'mail':test_email
                                      ,'givenname':'Sloppy'
                                      ,'sn':'McFly'}
                             ctmldap.createNewUser(req
                                                  ,cb)
                         }
                        ,function(user,pass,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'losers'}
                             req.body={'cn':'losers'
                                      ,uniquemember:[ctmldap.getDSN(user)]}
                             ctmldap.createGroup(req
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
                             var req = { __proto__: erq };
                             req.params={'cn':'losers'}
                             req.body={'description':'Group of losers'}
                             ctmldap.editGroup(req
                                               ,function(err,group){
                                                   should.not.exist(err)
                                                   cb(null,user,group)
                                               })
                         }
                        ,function(user,group,cb){
                             var req = { __proto__: erq };
                             req.params={'cn':'losers'}
                             ctmldap.loadGroup(req
                                               ,function(err,group){
                                                   should.not.exist(err)
                                                   group.description.should.equal('Group of losers')
                                                   cb(err,user,group)
                                               });
                        }
                        ,function(user,group,cb){
                             var req = { __proto__: erq };
                             req.params={'cn':'losers'}
                             req.body={'description':''}  // delete field
                             ctmldap.editGroup(req
                                               ,function(err,group){
                                                   should.not.exist(err)
                                                   cb(null,user,group)
                                               })
                         }
                        ,function(user,group,cb){
                             var req = { __proto__: erq };
                             req.params={'cn':'losers'}
                             ctmldap.loadGroup(req
                                               ,function(err,group){
                                                   should.not.exist(err)
                                                   group.should.not.have.property('description')
                                                   cb(err,user,group)
                                               });
                        }
                        ,function(user,group,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'luser',memberof:1}
                             ctmldap.loadUser(req
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
                             var req =  { __proto__: erq };
                             req.params={'cn':'losers'}
                             ctmldap.deleteGroup(req
                                                ,function(err){
                                                     should.not.exist(err)
                                                     cb(null,user)
                                                 });
                         }
                        ,function(user,cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'luser',memberof:1}
                             ctmldap.deleteUser(req
                                               ,function(e,r){ cb(e) })
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':newusergroup}
                             ctmldap.loadGroup(req
                                              ,function(e,g){
                                                   if(g !== undefined){
                                                       g.uniquemember.should.not.include(ctmldap.getDSN('luser'))
                                                   }
                                                   cb();
                                               })
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'luser',memberof:1}
                             ctmldap.loadUser(req
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
                             var req =  { __proto__: erq };
                             req.params={'uid':'loooser'}
                             req.body={uid:'loooser'
                                      ,'mail':test_email
                                      ,'givenname':'Sloppy'
                                      ,'sn':'McFly'}
                             ctmldap.createNewUser(req
                                                  ,cb)
                         }
                        ,function(user,pass,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'winters'}
                             req.body={cn:'winters'
                                      ,uniquemember:[ctmldap.getDSN('loooser')]}
                             ctmldap.createGroup(req
                                                ,function(err,group){
                                                     cb(null,group)
                                                 })
                         }
                        ,function(group,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'winters','uniquemember':'jmarca'}
                             ctmldap.addUserToGroup(req
                                                   ,function(err,group){
                                                        if(err) console.log(JSON.stringify(err))
                                                        should.not.exist(err)
                                                        should.exist(group)
                                                        group.should.have.property('uniquemember')
                                                        group.uniquemember.should.be.an.instanceOf(Array)
                                                        group.uniquemember.should.include(ctmldap.getDSN({uid:'jmarca'}))
                                                        group.uniquemember.should.include(ctmldap.getDSN({uid:'loooser'}))
                                                        group.uniquemember.should.have.length(2)
                                                        return cb(null,group)
                                                    })
                         }
                        ,function(group,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'winters','dropmember':'loooser'}
                             ctmldap.removeUserFromGroup(req
                                                   ,function(err,group){
                                                        should.not.exist(err)
                                                        should.exist(group)
                                                        group.should.have.property('uniquemember')
                                                        group.uniquemember.should.be.an.instanceOf(Array)
                                                        group.uniquemember.should.have.length(1)
                                                        group.uniquemember.should.include(ctmldap.getDSN({uid:'jmarca'}))
                                                        group.uniquemember.should.not.include(ctmldap.getDSN({uid:'loooser'}))
                                                        return cb(null,group)
                                                    })
                         }
                        ,function(group,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':group.cn}
                             ctmldap.deleteGroup(req
                                                ,function(err){
                                                     should.not.exist(err)
                                                     cb(null)
                                                 });
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'uid':'loooser'}
                             ctmldap.deleteUser(req
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
                             var req =  { __proto__: erq };
                             req.params={'cn':'summers',uniquemember:['jmarca'
                                                                     ,'crindt']}
                             ctmldap.createGroup(req
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
                             var req =  { __proto__: erq };
                             req.params={'cn':'summers','dropmember':'crindt'}
                             ctmldap.removeUserFromGroup(req
                                                        ,function(err,group){
                                                             should.not.exist(err)
                                                             should.exist(group)
                                                             group.should.have.property('uniquemember')
                                                             group.uniquemember.should.be.an.instanceOf(Array)
                                                             return cb(null,group)
                                                    })
                         }
                        ,function(group,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'summers','dropmember':'jmarca'}
                             ctmldap.removeUserFromGroup(req
                                                        ,function(err,group){
                                                             if(err) console.log('baka '+JSON.stringify(err))
                                                             should.not.exist(err)
                                                             should.not.exist(group)
                                                             return cb(null)
                                                    })
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'summers'}
                             ctmldap.deleteGroup(req
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
                             var req =  { __proto__: erq };
                             req.params={'cn':'springs'}
                             ctmldap.loadGroup(req
                                                ,function(err,group){
                                                     should.exist(err)
                                                     should.not.exist(group)
                                                     cb()
                                                 })
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'springs','uniquemember':'jmarca','create':true}
                             ctmldap.addUserToGroup(req
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
                             var req =  { __proto__: erq };
                             req.params={'cn':'springs','dropmember':'jmarca'}
                             ctmldap.removeUserFromGroup(req
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
                             var req =  { __proto__: erq };
                             req.params={'uid':'trouble4'}
                             req.body={'uid':'trouble4'
                                      ,'mail':test_email
                                      ,'givenname':'Flatly'
                                      ,'sn':'Refusing'
                                      }
                             ctmldap.createNewUser(req
                                                  ,cb)
                         }
                        ,function(user,pass,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'falls',uniquemember:user.uid,create:true}
                             ctmldap.addUserToGroup(req
                                                   ,function(err){
                                                        cb(err,user)
                                                    })
                         }
                        ,function(user,cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'weekends',uniquemember:user.uid,create:true}
                             ctmldap.addUserToGroup(req
                                                   ,function(err){
                                                        cb(err,user)
                                                    })
                         }
                        ,function(user,cb){
                             var req =  { __proto__: erq };
                             req.params={uid:user.uid}
                             ctmldap.deleteUser(req
                                               ,function(err){
                                                    cb(err)
                                                })
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'falls'}
                             ctmldap.loadGroup(req
                                              ,function(err,group){
                                                   should.exist(err)
                                                   should.not.exist(group)
                                                   cb()
                                               }
                                              )
                         }
                        ,function(cb){
                             var req =  { __proto__: erq };
                             req.params={'cn':'weekends'}
                             ctmldap.loadGroup(req
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

