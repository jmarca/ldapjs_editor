var should = require('should')
var ctmldap = require('../lib/ldapjs_editor')
var ssha = require('openldap_ssha')

var express = require('express');

var request = require('supertest');
var async = require('async')

var env = process.env;
var test_email = env.LDAP_USER_EMAIL;

describe('openldap ldapjs_editor',function(){
    before(function(setupdone){
        if (!setupdone) setupdone = function(){ return null; };
        async.parallel([function(cb){
                            ctmldap.deleteUser({params:{'uid':'trouble'}}
                                              ,null
                                              ,function(err){
                                                   console.log(1)
                                                   cb()
                                               });
                        }
                       ,function(cb){
                            ctmldap.deleteUser({params:{'uid':'trouble2'}}
                                              ,null
                                              ,function(err){
                                                   console.log(2)
                                                   cb()
                                               });
                        }
                       ,function(cb){
                            ctmldap.deleteUser({params:{'uid':'trouble3'}}
                                              ,null
                                              ,function(err){
                                                   console.log(3)
                                                   cb()
                                               });
                        }
                       ,function(cb){
                            ctmldap.deleteUser({params:{'uid':'more trouble'}}
                                              ,null
                                              ,function(err){
                                                   console.log(4)
                                                   cb()
                                               });
                        }]
                      ,setupdone
                      )
    })


    it('should load a known user',function(done){
        ctmldap.loadUser({params:{'uid':'jmarca'}}
                        ,null,function(err,user){
                                  should.not.exist(err);
                                  should.exist(user);
                                  user.mail.should.equal('jmarca@translab.its.uci.edu');
                                  done()
                              });
    });
    it('should fail to modify to a chosen password with incorrect current password'
      ,function(don){
           ctmldap.editUser({params:{'uid':'jmarca'
                                    ,'userpassword':'poobah'
                                    ,'currentpassword':'notit'
                                    }}
                           ,null
                           ,function(err,barePassword){
                                should.exist(err)
                                should.not.exist(barePassword)
                                don()
                            });
       });

    it('should not create a duplicate entry',function(done){
        ctmldap.createNewUser({params:{'uid':'jmarca'}},null,function(err,user){
            should.exist(err);
            should.not.exist(user);
            done()
        });
    });
    it('should create and delete a new entry',function(done){
        ctmldap.createNewUser({params:{'uid':'trouble2'
                                      ,'mail':test_email
                                      ,'givenname':'Studly'
                                      ,'sn':'McDude'
                                      }},null,function(err,user,barePassword){
                                                  should.not.exist(err);
                                                  should.exist(user);
                                                  ctmldap.deleteUser({params:{'uid':'trouble2'}}
                                                                    ,null
                                                                    ,function(err){
                                                                         should.not.exist(err)
                                                                         done()
                                                                    });
                                              });
    });


    it('should create and delete a new entry with camel case',function(done){
        ctmldap.createNewUser({params:{'uid':'trouble'
                                      ,'Mail':test_email
                                      ,'GivenName':'Studly'
                                      ,'SN':'McDude'
                                      }},null,function(err,user,barePassword){
                                                  should.not.exist(err);
                                                  should.exist(user);
                                                  ctmldap.deleteUser({params:{'uid':'trouble'}}
                                                                    ,null
                                                                    ,function(err){
                                                                         should.not.exist(err)
                                                                         done()
                                                                     });
                                              });
    });
    it('should create, login as, do a search, and delete a new entry with camel case',function(done){
        ctmldap.createNewUser({params:{'uid':'trouble3'
                                      ,'Mail':test_email
                                      ,'GivenName':'Studly'
                                      ,'SN':'McFly'
                                      }},null,function(err,user,barePassword){
                                                  should.not.exist(err);
                                                  should.exist(user);
                                                  async.series([function(cb){
                                                                    // try to log in with the new account
                                                                    var client = ctmldap.getClient();

                                                                    client.bind(ctmldap.getDSN(user),barePassword,function(err){
                                                                        should.not.exist(err)
                                                                        var dsn = 'ou=people,dc=ctmlabs,dc=org';
                                                                        ctmldap.query(null,dsn,client,function(err,result){
                                                                            should.not.exist(err)
                                                                            should.exist(result)
                                                                            client.unbind()
                                                                            cb()
                                                                        });
                                                                    });
                                                                }
                                                               ,function(cb){
                                                                    ctmldap.deleteUser({params:{'uid':'trouble3'}}
                                                                                      ,null
                                                                                      ,function(err){
                                                                                           should.not.exist(err)
                                                                                           cb()
                                                                                       });
                                                                }
                                                               ]
                                                              ,function(err){
                                                                   should.not.exist(err)
                                                                   done()
                                                               });
                                                      return null;
                                                  })

                                              });


    it('should create and modify a new entry',function(done){
        ctmldap.createNewUser({params:{'uid':'more trouble'
                                      ,'mail':test_email
                                      ,'givenName':'Bran'
                                      ,'sn':'McMuphin'
                                      }},null,function(err,user){
                                                  should.not.exist(err);
                                                  should.exist(user);
                                                  var pass;
                                                  async.series([function(cb){
                                                                    ctmldap.resetPassword({params:{'uid':'more trouble'}}
                                                                                         ,null
                                                                                         ,function(err,barePassword){
                                                                                              should.not.exist(err)
                                                                                              should.exist(barePassword)
                                                                                              pass = barePassword
                                                                                              ctmldap.loadUser({params:{'uid':'more trouble'}}
                                                                                                              ,null
                                                                                                              ,function(err,user){
                                                                                                                   should.not.exist(err)
                                                                                                                   ssha.checkssha(barePassword
                                                                                                                                 ,user.userpassword
                                                                                                                                 ,function(err,result){
                                                                                                                                      should.not.exist(err);
                                                                                                                                      should.exist(result);
                                                                                                                                      result.should.equal(true);
                                                                                                                                      cb()
                                                                                                                                  })
                                                                                                               })
                                                                                          })
                                                                }
                                                               ,function(cb){
                                                                    ctmldap.editUser({params:{'uid':'more trouble'
                                                                                             ,'mail':'farfalla@activimetrics.com'
                                                                                             ,'sn':'McBouncy'
                                                                                             }}
                                                                                    ,null
                                                                                    ,function(err){
                                                                                         should.not.exist(err)
                                                                                         ctmldap.loadUser({params:{'uid':'more trouble'}}
                                                                                                         ,null
                                                                                                         ,function(err,user){
                                                                                                              should.not.exist(err)
                                                                                                              user.mail.should.equal('farfalla@activimetrics.com')
                                                                                                              user.sn.should.equal('McBouncy')
                                                                                                              user.cn.should.equal('Bran McBouncy')
                                                                                                              cb()
                                                                                                          });
                                                                                     })
                                                                }
                                                               ,function(cb){
                                                                    ctmldap.editUser({params:{'uid':'more trouble'
                                                                                             ,'mail':'baka@activimetrics.com'
                                                                                             ,'sn':'McBlighty'
                                                                                             ,'userPassword':'smeagol'
                                                                                             ,'currentPassword':pass
                                                                                             }}
                                                                                    ,null
                                                                                    ,function(err){
                                                                                         should.not.exist(err)
                                                                                         ctmldap.loadUser({params:{'uid':'more trouble'}}
                                                                                                         ,null
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
                                                                                     })
                                                                }
                                                               ,function(cb){
                                                                    ctmldap.deleteUser({params:{'uid':'more trouble'}}
                                                                                      ,null
                                                                                      ,function(err){
                                                                                           should.not.exist(err)
                                                                                           cb()
                                                                                       });
                                                                }]
                                                               ,function(err){
                                                                    done(err);
                                                                });

                                              });
    })

    it('should get a list of all users',function(done){
        ctmldap.loadUsers(null,null,function(err,users){
            should.not.exist(err)
            should.exist(users)
            // need a better test here for making sure I got a proper list of users
            users.length.should.be.above(45)
            done()
        });
    })

    it('should get a list of all groups',function(done){
        ctmldap.loadGroups(null,null,function(err,groups){
            should.not.exist(err)
            should.exist(groups)
            // need a better test here for making sure I got a proper list of groups
            groups.length.should.be.above(5)
            done()
        });
    })

    it('should get a known group',function(done){
        ctmldap.loadGroup({params:{cn:'admin'}}
                         ,null
                         ,function(err,group){
                              should.not.exist(err)
                              should.exist(group)
                              group.should.have.property('uniquemember')
                              group.should.not.have.property('uniqueMember')
                              group.uniquemember.should.an.instanceOf(Array)
                              done()
                          });
    });

    it('should create a new group',function(done){
        async.waterfall([function(cb){
                             ctmldap.createNewUser({params:{uid:'luser'
                                                          ,'mail':test_email
                                                          ,'givenname':'Sloppy'
                                                          ,'sn':'McFly'}}
                                                  ,null
                                                  ,cb)
                         }
                        ,function(user,pass,cb){

                             ctmldap.createGroup({params:{cn:'losers'
                                                         ,uniquemember:[ctmldap.getDSN(user)]}}
                                                ,null
                                                ,function(err,group){
                                                     console.log(JSON.stringify(err))
                                                     should.not.exist(err)
                                                     should.exist(group)
                                                     group.should.have.property('uniquemember')
                                                     group.uniquemember.should.an.instanceOf(Array)
                                                     cb(null,user,group)
                                                 })
                         }
                        ,function(user,group,cb){
                             ctmldap.deleteGroup({params:{cn:group.cn}}
                                                 ,null
                                                ,function(err){
                                                     console.log(JSON.stringify(err))
                                                     should.not.exist(err)
                                                     cb(user)
                                                 });
                         }
                        ,function(user,cb){
                             ctmldap.deleteUser({params:{uid:user.uid}}
                                               ,null
                                               ,cb)
                         }]
                       ,function(err){
                            done()
                        });

    });
});

