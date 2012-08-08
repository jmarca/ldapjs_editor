
MOCHA_OPTS=bail
REPORTER = spec
TIMEOUT = 12000


check: test

test: test-unit

test-unit:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS)

test-cov: lib-cov
	@EXPRESS_COV=1 $(MAKE) test REPORTER=html-cov > coverage.html

lib-cov:
	@jscoverage lib lib-cov

.PHONY:  test test-unit
