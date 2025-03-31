BACKEND_DIR=backend
INFRA_DIR=infra
LAMBDA_NAME=trc-yoga-update-lambda

# Default target
.PHONY: all
all: build-backend deploy-infra

# Backend targets
.PHONY: build-backend
build-backend:
	cd $(BACKEND_DIR) && GOOS=linux GOARCH=amd64 go build -o bootstrap main.go
	zip -j $(BACKEND_DIR)/lambda.zip $(BACKEND_DIR)/bootstrap

.PHONY: exec-backend
exec-backend:
	aws lambda invoke --function-name $(LAMBDA_NAME) /dev/stdout

# Terraform targets
.PHONY: init-infra
init-infra:
	cd $(INFRA_DIR) && terraform init

.PHONY: plan-infra
plan-infra: init-infra
	cd $(INFRA_DIR) && terraform plan

.PHONY: deploy-infra
deploy-infra: init-infra
	cd $(INFRA_DIR) && terraform apply

.PHONY: destroy-infra
destroy-infra: init-infra
	cd $(INFRA_DIR) && terraform destroy

# Utility targets
.PHONY: clean
clean:
	rm -f $(BACKEND_DIR)/bootstrap $(BACKEND_DIR)/lambda.zip

.PHONY: fmt
fmt:
	cd $(BACKEND_DIR) && go fmt ./...
	cd $(INFRA_DIR) && terraform fmt

.PHONY: lint
lint:
	cd $(BACKEND_DIR) && golangci-lint run
