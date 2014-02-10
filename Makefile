test:
	@mocha
cov:
	_mocha  -r blanket -R html-cov |firefox "data:text/html;base64,$$(base64 -w 0 <&0)"

.PHONY: test
