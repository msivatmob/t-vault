/*
* =========================================================================
* Copyright 2019 T-Mobile, US
* 
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
* See the readme.txt file for additional language around disclaimer of warranties.
* =========================================================================
*/

'use strict';
(function (app) {
    app.controller('ChangeSafeCtrl', function ($scope, $rootScope, Modal, $timeout, fetchData, $http, UtilityService, Notifications, $window, $state, $stateParams, $q, SessionStore, vaultUtilityService, ModifyUrl, AdminSafesManagement, AppConstant, filterFilter, orderByFilter) {
        $scope.selectedGroupOption = '';            // Selected dropdown value to be used for filtering
        $rootScope.showDetails = true;              // Set true to show details view first
        $scope.similarSafes = 0;
        $rootScope.activeDetailsTab = 'details';
        $scope.typeDropdownDisable = false;         // Variable to be set to disable the dropdown button to select 'type'
        $scope.safeCreated = false;                 // Flag to indicate if a safe has been creted
        $scope.isEditSafe = false;
        $scope.awsRadioBtn = {};                    // Made an object instead of single variable, to have two way binding between
        $scope.approleRadioBtn = {};                                    // modal and controller

        $scope.inputValue = {
            "userNameVal": '',
            "grpNameVal": '',
            "userNameValEmpty": false,
            "grpNameValEmpty": false
        }
        $scope.usrRadioBtnVal = 'read';             // Keep it in lowercase
        $scope.grpRadioBtnVal = 'read';             // Keep it in lowercase
        $scope.awsRadioBtn['value'] = 'read';       // Keep it in lowercase
        $scope.approleRadioBtn['value'] = 'read';
        $scope.isEmpty = UtilityService.isObjectEmpty;
        $scope.roleNameSelected = false;
        $scope.isUserPermissionEmpty = true;
        $scope.userAutoCompleteEnabled = false;
        $scope.groupAutoCompleteEnabled = false;
        $scope.disableAddBtn = true;
        $scope.isUserSearchLoading = false;
        $scope.userSearchList = [];
        $scope.isOwnerSelected = false;
        $scope.safeTransferInValid = true;
        $scope.isAdmin = false;
        $scope.isTransferInProgress = false;
        $scope.awsConfPopupObj = {
            "auth_type":"",
            "role": "",
            "bound_account_id": "",
            "bound_region": "",
            "bound_vpc_id": "",
            "bound_subnet_id": "",
            "bound_ami_id": "",
            "bound_iam_instance_profile_arn": "",
            "bound_iam_role_arn": "",
            "policies": "",
            "bound_iam_principal_arn": "",
            "resolve_aws_unique_ids":"false"
        };
        $scope.approleConfPopupObj = {
            "token_max_ttl":"",
            "token_ttl": "",
            "role_name": "",
            "policies": "",
            "bind_secret_id": "",
            "secret_id_num_uses": "",
            "secret_id_ttl": "",
            "token_num_uses": ""
        };
        $scope.tableOptions = [
            {
                "type": "User Safe"
            }, {
                "type": "Shared Safe"
            }, {
                "type": "Application Safe"
            }
        ];

        $scope.radio = {
            value: 'read',
            options: [{
                'text': 'read'
            }, {
                'text': 'write'
            }, {
                'text': 'deny'
            }]
        };

        $scope.bindSecretRadio = {
            value: 'false',
            options: [{
                'text': 'false'
            }, {
                'text': 'true'
            }]
        };

        $scope.detailsNavTags = [{
            displayName: 'DETAILS',
            navigationName: 'details',
            addComma: true,
            show: true
        }, {
            displayName: 'PERMISSIONS',
            navigationName: 'permissions',
            addComma: false,
            show: true
        }];
        $scope.isUserEmailSelected = false;

        var clearInputPermissionData = function () {
            $scope.inputValue = {
                "userNameVal": '',
                "grpNameVal": '',
                "userNameValEmpty": false,
                "grpNameValEmpty": false
            }
            $scope.disableAddBtn = true;
            $scope.clearInputValue("addUser");
            $scope.clearInputValue("addGroup");
        }

        $scope.isApproleBtnDisabled = function() {
            if ($scope.roleNameSelected){
                    return false;
            }
            return true;
        }
        $scope.goBack = function () {
            var targetState = 'manage';
            if (SessionStore.getItem("isAdmin") === 'true') {
                targetState = 'admin';
            }
            if ($scope.goBackToAdmin !== true) {
                if ($rootScope.showDetails === true) {
                    $state.go(targetState);
                }
                else {
                    $rootScope.showDetails = true;
                    $rootScope.activeDetailsTab = 'details';
                    $scope.checkOwnerEmailHasValue('details');
                }
            }
            else {
                if ($rootScope.lastVisited) {
                    $state.go($rootScope.lastVisited);
                } else
                    $state.go(targetState);
            }
        }

        $scope.roleNameSelect = function() {
            var queryParameters = $scope.dropDownRoleNames.selectedGroupOption.type;
            $scope.roleNameSelected = true;
            $scope.approleConfPopupObj.role_name = queryParameters;
        }

        $scope.error = function (size) {
            Modal.createModal(size, 'error.html', 'ChangeSafeCtrl', $scope);
        };

        /************************  Functions for autosuggest start here ***************************/
        //initialise values
        $scope.domainName = '';
        if (AppConstant.DOMAIN_NAME) {
            $scope.domainName = AppConstant.DOMAIN_NAME.toLowerCase();
        }       
        $scope.searchValue = {
            userName: '',
            groupName: ''
        };
        $scope.userNameDropdownVal = [];
        $scope.groupNameDropdownVal = [];
        
        $scope.totalDropdownVal = [];
        $rootScope.loadingDropDownData = false;
        
        $scope.showInputLoader = {
            'show':false
        };
        $scope.inputSelected = {
            'select': false
        }

        var delay = (function(){
            var timer = 0;
            return function(callback, ms){
              clearTimeout (timer);
              timer = setTimeout(callback, ms);
            };

        })(); 
        var lastContent;
        var duplicateFilter = (function(content){
          return function(content,callback){
            content=$.trim(content);
            // callback provided for content length > 2
            if(content !== lastContent && content.length > 2){
              callback(content);
            }
            lastContent = content;
          };
        })();

        //clear selected value on cross icon click
        $scope.clearInputValue = function(id) {
            document.getElementById(id).value = "";
            $scope.inputSelected.select = false;
            $scope.searchValue = {
                userName: '',
                groupName: ''
            };
            lastContent = '';
            $scope.showNoMatchingResults = false;
            $scope.disableAddBtn = true;
        }

        //clear selcted email id on cross icon click
        $scope.clearOwnerEmailInputValue = function() {
            $scope.safe.owner = '';
            $scope.inputSelected.select = false;
            lastContent = '';
            $scope.showNoMatchingResults = false;
            $scope.invalidEmail = false;
            $scope.isUserEmailSelected = false;
        }
        // on navigation to details page check owner email field has value, if yes highlight box. 
        $scope.checkOwnerEmailHasValue = function(navigateToDetail) {
            if(navigateToDetail === 'details' && $scope.safe.owner && $scope.safe.owner.length > 0) {
                $scope.inputSelected.select = true;
            }
        }
        // function call on input keyup 
        $scope.onKeyUp = function(newVal, variableChanged, forOwner) {
            if (newVal.length === 0) {
                return;
            }
            $scope.invalidEmail = false;
            $scope.showNoMatchingResults = false;        
            $scope.showInputLoader.show = false;
            $scope.inputSelected.select = false;
            $scope.autoCompleteforOwner = false;
            //check autocomplete is for owner email id
            if(forOwner) {
                $scope.autoCompleteforOwner = true;
            }
            if (newVal.userName && variableChanged === 'userName') {
                newVal.groupName = "";           
                $scope.userNameDropdownVal = [];
            } else if (newVal.groupName &&  variableChanged === 'groupName') {
                newVal.userName = "";
                $scope.groupNameDropdownVal = [];
            }
             if (variableChanged === 'userName') {
                if (!UtilityService.getAppConstant('AD_USERS_AUTOCOMPLETE') ) {
                    return;
                }
             } else if (variableChanged === 'groupName') {
                 if(!UtilityService.getAppConstant('AD_GROUP_AUTOCOMPLETE') || newVal.groupName.length < 4) {
                    return;
                 }
             }
             $scope.isUserEmailSelected = false;
             var newLetter = newVal[variableChanged];
             if (variableChanged != 'userName' && variableChanged != 'groupName') {
               newLetter = newLetter.replace(" ", "");
             }
                initiateAutoComplete(variableChanged, ['loading']);
           // delay before providing api call      
          delay(function(){
              // check for duplicate values with previous value
            duplicateFilter(newLetter, function(value){
                $scope.showInputLoader.show = true;
                $scope.getDropdownDataForPermissions(variableChanged, value, forOwner);                
            });          
          }, 500 ); // delay of 500ms provided before making api call
        }

        $scope.getDropdownDataForPermissions = function (searchFieldName, searchFieldText, forOwner) {      
            if (searchFieldText.length > 2) {
                vaultUtilityService.getDropdownDataForPermissions(searchFieldName, searchFieldText, forOwner).then(function (res, error) {
                    var serviceData;
                    if (res) {
                        serviceData = res;
                        $scope.loadingDataFrDropdown = serviceData.loadingDataFrDropdown;
                        $scope.erroredFrDropdown = serviceData.erroredFrDropdown;
                        $scope.successFrDropdown = serviceData.successFrDropdown;
                        if (serviceData.response.data.data.values.length === 0) {
                            $scope.showNoMatchingResults = true;
                        }
                        massageDataFrPermissionsDropdown(searchFieldName, searchFieldText, serviceData.response.data.data.values, forOwner);
                        $scope.$apply();
                    } else {
                        serviceData = error;
                        $scope.commonErrorHandler(serviceData.error, serviceData.error || serviceData.response.data, "getDropdownData");

                    }
                },
                function (error) {
                    // Error handling function when api fails
                    $scope.showInputLoader.show = false;
                    if (error.status === 500) {
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_NETWORK');
                        $scope.error('md');
                    } else if(error.status !== 200 && (error.xhrStatus === 'error' || error.xhrStatus === 'complete')) {                        
                        if (searchFieldName === "userName" && $scope.searchValue.userName.length > 0) {
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_AUTOCOMPLETE_USERNAME');
                        } else if (searchFieldName === "groupName" && $scope.searchValue.groupName.length > 0) {
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_AUTOCOMPLETE_GROUPNAME');
                        }
                        $scope.error('md');
                    }                    
                })
            }
        };
        $scope.commonErrorHandler = function (error, response, block) {
            if (block === null) {
                $scope.loadingDataFrRoles = false;
                $scope.erroredInRoles = true;
                $scope.successInRoles = false;
                $scope.errorMsgFrRoles = "Please try again, if the issue persists contact Vault Administrator";
                console.log("Data from service is not in expected Format ", error);
                if ((response != undefined) || (response != null)) {
                    if (response.message) {
                        $scope.errorMsg = response.message;
                        console.log(response.message);
                    }
                }
            }
        }
        var massageDataFrPermissionsDropdown = function (searchFieldName, searchFieldText, dataFrmApi, forOwner) {
            var serviceData = vaultUtilityService.massageDataFrPermissionsDropdown(searchFieldName, searchFieldText, dataFrmApi, forOwner);
            $scope.showInputLoader.show = false;
               if (searchFieldName === 'userName') {
                    $scope.userNameDropdownVal = serviceData.sort();
                    initiateAutoComplete(searchFieldName, $scope.userNameDropdownVal, forOwner);
                } else if (searchFieldName === 'groupName') {
                    $scope.groupNameDropdownVal = serviceData.sort();
                    initiateAutoComplete(searchFieldName, $scope.groupNameDropdownVal, forOwner);
                }        
           
            $rootScope.loadingDropDownData = false;
        }

        var initiateAutoComplete = function(searchFieldName, data, forOwner) {
            var id;
            if (searchFieldName === "userName") {
                id = '#addUser';
                // for owner email id provide autocomplete
                if ($scope.autoCompleteforOwner) {
                    id = "#addOwnerEmail"
                }
            } else if (searchFieldName === "groupName") {
                id = '#addGroup';
            }
            $(id).focusout();
            $(id).trigger("focus");             
            $(id)
                .autocomplete({
                    source: data,
                    minLength: 3,
                    select: function(event, ui) {                        
                        var selectedName = ui.item.value.toLowerCase();
                        if (selectedName.includes(".com")) {
                            event.preventDefault();
                            if ($scope.autoCompleteforOwner) {
                                this.value = ui.item.value;
                            }else if (searchFieldName === "userName") {
                                this.value = ui.item.value.split(' - ')[1];
                            } else if (searchFieldName === "groupName") {
                                this.value = ui.item.value.split(' - ')[0];
                            }                 
                        }
                        $scope.inputSelected.select = true; 
                        $scope.showNoMatchingResults = false;  
                        $scope.invalidEmail = false;                
                        $scope.disableAddBtn = false;
                        $scope.isUserEmailSelected = true;
                        $(id).trigger('change');
                        $(id).blur();                     
                        $scope.$apply();
                    },
                    focus: function(event, ui) {
                        event.preventDefault();
                    }
                })
                .focus(function() {
                    $(this).keydown();
                })
                .select(function() {
                    $scope.inputSelected.select = true;
                    $scope.showNoMatchingResults = false; 
                });
        }


        /***************************************  Functions for autosuggest end here **********************************************/

        $scope.safeEditSafe = function () {
            $scope.goBackToAdmin = true;
            var successCondition = true;
            $scope.goBack();
        }
        $scope.getPath = function () {
            var vaultType = $scope.dropDownOptions.selectedGroupOption.type;
            switch ($scope.dropDownOptions.selectedGroupOption.type) {
                case "Application Safe":
                    vaultType = 'apps';
                    break;
                case "User Safe":
                    vaultType = 'users';
                    break;
                case "Shared Safe":
                    vaultType = 'shared';
                    break;
            }

            var setPath = vaultType + '/' + UtilityService.formatName($scope.safe.name);
            return setPath;
        }
        $scope.editPermission = function (type, editMode, user, permission) {
            if (editMode) {
                var editingPermission = true;
                $scope.deletePermission(type, editMode, editingPermission, user, permission);
            }
        }
        $scope.replaceSpaces = function () {
            $scope.safe.name = UtilityService.formatName($scope.safe.name);
        }

        $scope.deletePermission = function (type, editMode, editingPermission, key, permission) {
            if (editMode) {
                try {
                    key = key.replace($scope.domainName, '');
                    $scope.isLoadingData = true;
                    var setPath = $scope.getPath();
                    var apiCallFunction = '';
                    var reqObjtobeSent = {};
                    switch (type) {
                        case 'users':
                            apiCallFunction = AdminSafesManagement.deleteUserPermissionFromSafe;
                            if (editingPermission) {
                								reqObjtobeSent = {
                									"path": setPath,
                									"username": key,
                									"access": permission
                								};
                							}
                							else {
                								reqObjtobeSent = {
                									"path": setPath,
                									"username": key
                								};
                							}
                            break;
                        case 'groups' :
                            apiCallFunction = AdminSafesManagement.deleteGroupPermissionFromSafe;
                            reqObjtobeSent = {
                                "path": setPath,
                                "groupname": key
                            };
                            break;
                        case 'AWSPermission' :
                            if (editingPermission) {
                                apiCallFunction = AdminSafesManagement.detachAWSPermissionFromSafe;
                            }
                            else {
                                apiCallFunction = AdminSafesManagement.deleteAWSPermissionFromSafe;
                            }
                            reqObjtobeSent = {
                                "path": setPath,
                                "role": key
                            };
                            break;
                        case 'AppRolePermission' :
                            apiCallFunction = AdminSafesManagement.detachAppRolePermissionFromSafe;
                            reqObjtobeSent = {
                                "path": setPath,
                                "role_name": key
                            };
                            break;
                    }
                    apiCallFunction(reqObjtobeSent).then(
                        function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    $scope.isLoadingData = false;
                                    if (editingPermission) {
                                        $scope.addPermission(type, key, permission, true);  // This will be executed when we're editing permissions
                                    }
                                    else {
                                        $scope.requestDataFrChangeSafe();
                                        // if (type === "users" && key === SessionStore.getItem("username")) {
                                        //     return Modal.createModalWithController('stop.modal.html', {
                                        //         title: 'Permission changed',
                                        //         message: 'For security reasons, if you add or modify permission to yourself, you need to log out and log in again for the added or modified permissions to take effect.'
                                        //       });
                                        // }
                                        if (type === 'AppRolePermission') {
                                            // delete approle
                                        }
                                        var notification = UtilityService.getAParticularSuccessMessage('MESSAGE_SAFE_DELETE');
                                        Notifications.toast(key + "'s permission" + notification);
                                    }
                                }
                                catch (e) {
                                    console.log(e);
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                error('md');
                            }
                        },
                        function (error) {

                            // Error handling function
                            console.log(error);
                            $scope.isLoadingData = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                            $scope.error('md');

                        })
                } catch (e) {

                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');

                }
            }
        }
        $scope.editAWSConfigurationDetails = function (editMode, rolename) {
            if (editMode) {
                try {
                    $scope.isLoadingData = true;
                    var setPath = $scope.getPath();
                    var queryParameters = rolename;
                    var updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('getAwsConfigurationDetails', queryParameters);
                    AdminSafesManagement.getAWSConfigurationDetails(null, updatedUrlOfEndPoint).then(
                        function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    // $scope.awsConfPopupObj = response.data;
                                    // $scope.awsConfPopupObj['role'] = rolename;
                                    $scope.editingAwsPermission = {"status": true};
                                    $scope.awsConfPopupObj = {
                                        "auth_type": response.data.auth_type,
                                        "role": rolename,
                                        "bound_account_id": response.data.bound_account_id,
                                        "bound_region": response.data.bound_region,
                                        "bound_vpc_id": response.data.bound_vpc_id,
                                        "bound_subnet_id": response.data.bound_subnet_id,
                                        "bound_ami_id": response.data.bound_ami_id,
                                        "bound_iam_instance_profile_arn": response.data.bound_iam_instance_profile_arn,
                                        "bound_iam_role_arn": response.data.bound_iam_role_arn,
                                        "policies": response.data.policies,
                                        "bound_iam_principal_arn": response.data.bound_iam_principal_arn,
                                        "resolve_aws_unique_ids": "false"
                                    };
                                    $scope.policies = response.data.policies;
                                    $scope.awsRadioBtn['value'] = $rootScope.AwsPermissionsData.data[rolename];
                                    $scope.open('md');   // open the AWS configuration popup with prefilled data
                                }
                                catch (e) {
                                    console.log(e);
                                    $scope.isLoadingData = false;
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                error('md');
                            }
                        },
                        function (error) {

                            // Error handling function
                            console.log(error);
                            $scope.isLoadingData = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                            $scope.error('md');

                        })
                } catch (e) {

                    // To handle errors while calling 'fetchData' function
                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');

                }
            }
        }
        $scope.createSafe = function () {
            if ($scope.safeCreated === true) {
                if(!angular.equals($scope.safePrevious, $scope.safe)) {
                    $scope.editSafe();
                } else {                    
                    $rootScope.showDetails = false;               // To show the 'permissions' and hide the 'details'
                    $rootScope.activeDetailsTab = 'permissions';
                    $scope.isLoadingData = false;
                }
            }
            else if ($scope.dropDownOptions.selectedGroupOption.type === "Select Type") {
                $rootScope.noTypeSelected = true;
            }
            else {
                try {
                    $scope.isLoadingData = true;
                    var setPath = $scope.getPath();
                    $scope.safe.name = UtilityService.formatName($scope.safe.name);
                    var payload = {"path": setPath, "data": $scope.safe};

                    AdminSafesManagement.createSafe(payload).then(function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    $scope.isLoadingData = false;
                                    $rootScope.showDetails = false;               // To show the 'permissions' and hide the 'details'
                                    $rootScope.activeDetailsTab = 'permissions';
                                    $scope.safeCreated = true;                // Flag set to indicate safe has been created
                                    $scope.typeDropdownDisable = true;
                                    var notification = UtilityService.getAParticularSuccessMessage('MESSAGE_CREATE_SUCCESS');
                                    var currentSafesList = JSON.parse(SessionStore.getItem("allSafes"));
                                    if (currentSafesList!=null) {
                                        currentSafesList.push($scope.safe.name);
                                    }
                                    else {
                                        currentSafesList = [];
                                    }
                                    SessionStore.setItem("allSafes", JSON.stringify(currentSafesList));
                                    Notifications.toast($scope.safe.name + ' safe' + notification);
                                    $scope.safePrevious = angular.copy($scope.safe);
                                } catch (e) {
                                    console.log(e);
                                    $scope.isLoadingData = false;
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                error('md');
                            }
                        },
                        function (error) {
                            // Error handling function
                            console.log(error);
                            $scope.isLoadingData = false;
                            $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(error);
                            $scope.error('md');
                        })
                } catch (e) {
                    // To handle errors while calling 'fetchData' function
                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                }
            }
        }
        $scope.appNameSelect = function(){
            $scope.appNameSelected =false;
            if($scope.dropdownApplicationName !==undefined){
                var appId = $scope.dropdownApplicationName.selectedGroupOption.id;
            $scope.dropdownApplicationName.selectedGroupOption.type;
            $scope.appName = $scope.dropdownApplicationName.selectedGroupOption.type;
             $scope.safe.appName=$scope.appName;
            $scope.appNameSelected = true;
            }
        }
        var getWorkloadDetails = function () {
            $scope.isApplicationsLoading = true;
            AdminSafesManagement.getApprolesFromCwm().then(function (response) {
                if (UtilityService.ifAPIRequestSuccessful(response)) {
                    $scope.isApplicationsLoading = false;
                    $scope.isAppNamesLoading = true;
                    var data = response.data;
                    $scope.appNameTableOptions=[];                    
                     for (var index = 0;index<data.length;index++) {
                        var value = '';
                        var appTag = '';
                        var appID = '';
                        var name = '';
                        if (data[index].appName !='' && data[index].appName != null && data[index].appName != undefined) {
                            value = data[index].appName;
                            name = value;
                        }
                        if (data[index].appID !='' && data[index].appID != null && data[index].appID != undefined) {
                            appID = data[index].appID;
                        }
                        if (data[index].appTag !='' && data[index].appTag != null && data[index].appTag != undefined) {
                            appTag = data[index].appTag;
                        }
                        if(JSON.parse(SessionStore.getItem("isAdmin")) == true){
                        	$scope.appNameTableOptions.push({"type":value, "name": name, "tag": appTag, "id": appID});
                        }
                        if(JSON.parse(SessionStore.getItem("isAdmin")) == false){
                            $scope.appNameTableOptions.push({"type":value, "name": name, "tag": appTag, "id": appID});
                        }
                    }
                    $scope.getAppnames();
                     $scope.isAppNamesLoading = false;
                }
                else {
                    $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                    $scope.error('md');
                }
            },
            function (error) {
                // Error handling function
                console.log(error);
                $scope.isAppNamesLoading = false;
                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                $scope.error('md');
            })
        }
        $scope.getAppnames = function () {
            if($scope.appNameTableOptions!==undefined){
                $scope.appNameTableOptionsSort = $scope.appNameTableOptions.sort(function (a, b) {
                    return (a.name > b.name ? 1 : -1);
                });   
                $scope.dropdownApplicationName = {
                        'selectedGroupOption': {"type": "Select Application Name"},       // As initial placeholder
                        'tableOptions':  $scope.appNameTableOptionsSort 
                    } 
                }
        }
        $scope.editSafe = function () {
            try {
                $scope.isLoadingData = true;
                var setPath = $scope.getPath();
                var payload = {"path": setPath, "data": $scope.safe};
                AdminSafesManagement.editSafe(payload).then(function (response) {
                        if (UtilityService.ifAPIRequestSuccessful(response)) {
                            // Try-Catch block to catch errors if there is any change in object structure in the response
                            try {
                                $scope.isLoadingData = false;
                                $rootScope.showDetails = false;               // To show the 'permissions' and hide the 'details'
                                $rootScope.activeDetailsTab = 'permissions';
                                var notification = UtilityService.getAParticularSuccessMessage('MESSAGE_UPDATE_SUCCESS');
                                Notifications.toast($scope.safe.name + ' safe' + notification);
                                $scope.safePrevious = angular.copy($scope.safe);
                            } catch (e) {
                                console.log(e);
                                $scope.isLoadingData = false;
                                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                $scope.error('md');
                            }
                        }
                        else {
                            $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                            error('md');
                        }
                    },
                    function (error) {
                        // Error handling function
                        console.log(error);
                        $scope.isLoadingData = false;
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                        $scope.error('md');
                    })
            } catch (e) {
                // To handle errors while calling 'fetchData' function
                console.log(e);
                $scope.isLoadingData = false;
                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                $scope.error('md');
            }
        }


        $rootScope.goToPermissions = function () {
            $scope.invalidEmail = false;
            $scope.showNoMatchingResults = false;
            var emailInput = document.getElementById('addOwnerEmail').value;
            if (emailInput =="" || emailInput == undefined) {
                $scope.invalidEmail = true;
            } else {
                $timeout(function () {
                    if ($scope.isEditSafe) {
                        $rootScope.showDetails = false;               // To show the 'permissions' and hide the 'details'
                        $rootScope.activeDetailsTab = 'permissions';
                        if(!angular.equals($scope.safePrevious, $scope.safe)){
                            $scope.editSafe();
                        }                        
                    }
                    else {
                        $rootScope.noTypeSelected = false;
                        $scope.createSafe();
                    }
                })
            }
        }


        $scope.requestDataFrChangeSafe = function () {
            $scope.isLoadingData = true;
            if ($stateParams.safeObject) {

                // Prefilled values when editing
                $scope.changeSafeHeader = "EDIT SAFE";
                $scope.isEditSafe = true;
                $scope.typeDropdownDisable = true;
                try {
                    var queryParameters = "path=" + $stateParams.safeObject.safeType + '/' + $stateParams.safeObject.safe;
                    var updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('getSafeInfo', queryParameters);
                    AdminSafesManagement.getSafeInfo(null, updatedUrlOfEndPoint).then(
                        function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {

                                if ($rootScope.showDetails !== true) {
                                    document.getElementById('addUser').value = '';
                                    document.getElementById('addGroup').value = '';
                                }
                                $scope.inputSelected.select = false;
                                $scope.searchValue = {
                                    userName: '',
                                    groupName: ''
                                };
                                lastContent = '';
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    $scope.isLoadingData = false;
                                    var object = response.data.data;
                                    if(object && object.users && UtilityService.getAppConstant('AUTH_TYPE').toLowerCase() === "ldap1900") {
                                        var data = object.users;
                                        // get all object keys and iterate over them
                                            Object.keys(object.users).forEach(function(ele) {
                                                ele = ele.replace($scope.domainName, '');
                                                var newEle = ele + $scope.domainName;
                                                data[newEle] = data[ele];
                                                delete data[ele];
                                            })
                                            object.users = data;
                                    }
                                    $scope.UsersPermissionsData = object.users;
                                    $scope.GroupsPermissionsData = object.groups;
                                    $rootScope.AwsPermissionsData = {
                                        "data": object['aws-roles']
                                    }
                                    $rootScope.AppRolePermissionsData = {
                                        "data": object['app-roles']
                                    }
                                    $scope.safe = {
                                        name: object.name || $stateParams.safeObject.safe,
                                        owner: object.owner || $stateParams.safeObject.owner || '',
                                        description: object.description || $stateParams.safeObject.description || '',
                                        type: $stateParams.safeObject.type || object.type ||$scope.dropDownOptions.selectedGroupOption.type || '',
                                        appName:$stateParams.safeObject.appName|| ''
                                    }
                                    $scope.safePrevious = angular.copy($scope.safe);
                                    $scope.selectedGroupOption = $scope.safe;
                                    $scope.dropDownOptions = {
                                        'selectedGroupOption': $scope.selectedGroupOption,
                                        'tableOptions': $scope.tableOptions
                                    }
                                    $scope.dropdownApplicationName = {
                                        'selectedGroupOption': $scope.selectedGroupOption,
                                        'tableOptions': $scope.appNameTableOptionsSort
                                    }
                                    if($scope.activeDetailsTab === 'details') {
                                         $scope.checkOwnerEmailHasValue('details');
                                    }

                                    getUserDisplayNameDetails();
                                    $scope.isUserEmailSelected = true;
                                }
                                catch (e) {
                                    console.log(e);
                                    $scope.isLoadingData = false;
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                error('md');
                            }
                        },
                        function (error) {
                            // Error handling function
                            if ($rootScope.showDetails !== true) {
                                document.getElementById('addUser').value = '';
                                document.getElementById('addGroup').value = '';
                            }
                            console.log(error);
                            $scope.isLoadingData = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                            $scope.error('md');

                        })
                } catch (e) {
                    // To handle errors while calling 'fetchData' function
                    if ($rootScope.showDetails !== true) {
                        document.getElementById('addUser').value = '';
                        document.getElementById('addGroup').value = '';
                    }
                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');

                }

            }
            else {
                $scope.changeSafeHeader = "CREATE SAFE";
                $scope.isEditSafe = false;
                $scope.checkOwnerEmailHasValue('details');
                // Refreshing the data while adding/deleting/editing permissions when creating safe (not edit-safe)

                try {
                    $rootScope.AwsPermissionsData = {}
                    $rootScope.AppRolePermissionsData = {}
                    if (($scope.safe.name !== '') && ($scope.safe.owner !== '')) {
                        var queryParameters = "path=" + $scope.getPath();
                        var updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('getSafeInfo', queryParameters);
                        AdminSafesManagement.getSafeInfo(null, updatedUrlOfEndPoint).then(
                            function (response) {
                                if (UtilityService.ifAPIRequestSuccessful(response)) {
                                    if ($rootScope.showDetails !== true) {
                                        document.getElementById('addUser').value = '';
                                        document.getElementById('addGroup').value = '';
                                    }
                                    $scope.inputSelected.select = false;
                                    $scope.searchValue = {
                                        userName: '',
                                        groupName: ''
                                    };
                                    lastContent = '';
                                    // Try-Catch block to catch errors if there is any change in object structure in the response
                                    try {
                                        $scope.isLoadingData = false;
                                        var object = response.data.data;
                                        if(object && object.users && UtilityService.getAppConstant('AUTH_TYPE').toLowerCase() === "ldap1900") {
                                            var data = object.users;
                                            // get all object keys and iterate over them
                                                Object.keys(object.users).forEach(function(ele) {
                                                    ele.replace($scope.domainName, '');
                                                    var newEle = ele + $scope.domainName;
                                                    data[newEle] = data[ele];
                                                    delete data[ele];
                                                })
                                                object.users = data;
                                        }
                                        $scope.UsersPermissionsData = object.users;
                                        $scope.GroupsPermissionsData = object.groups;
                                        $rootScope.AwsPermissionsData = {
                                            "data": object['aws-roles']
                                        }
                                        $rootScope.AppRolePermissionsData = {
                                            "data": object['app-roles']
                                        }

                                        getUserDisplayNameDetails();
                                    }
                                    catch (e) {
                                        console.log(e);
                                        $scope.isLoadingData = false;
                                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                        $scope.error('md');
                                    }
                                }
                                else {
                                    $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                    error('md');
                                }
                            },
                            function (error) {
                                // Error handling function
                                console.log(error);
                                $scope.isLoadingData = false;
                                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                                $scope.error('md');

                            });
                    }
                    else {
                        $scope.isLoadingData = false;
                    }
                } catch (e) {
                    // To handle errors while calling 'fetchData' function
                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');

                }
            }
        }

        var getUserDisplayNameDetails = function () {
            $scope.isLoadingData = true;
            $scope.userNames = [];
            $scope.UsersPermissionsDetails = [];
            $scope.UsersDisplayNameData = [];
            for (var key in $scope.UsersPermissionsData) {
                $scope.userNames.push(key);
            }
            if ($scope.userNames !== undefined && $scope.userNames.length > 0) {
                $scope.isUserPermissionEmpty = false;
                vaultUtilityService.getAllUsersDataForPermissions($scope.userNames.join()).then(function (res, error) {
                    var serviceData;
                    if (res) {
                        $scope.isLoadingData = false;
                        serviceData = res;
                        $scope.UsersDisplayNameData = serviceData.response.data.data.values;
                        for (var i=0;i<$scope.UsersDisplayNameData.length;i++) {
                            var userNameKey = $scope.UsersDisplayNameData[i].userName.toLowerCase();
                            var userDisplayName = $scope.UsersDisplayNameData[i].displayName + " ("+$scope.UsersDisplayNameData[i].userName+")";
                            var permissionVal = "";
                            for (var key in $scope.UsersPermissionsData) {
                                if(key.toLowerCase() === userNameKey) {
                                    permissionVal = $scope.UsersPermissionsData[key.toLowerCase()];
                                }
                            }
                            $scope.UsersPermissionsDetails.push({"key":userNameKey, "value":permissionVal, "displayName":userDisplayName});
                        }
                        $scope.$apply();
                    } else {
                        $scope.isLoadingData = false;
                        serviceData = error;
                        $scope.commonErrorHandler(serviceData.error, serviceData.error || serviceData.response.data, "getDropdownData");

                    }
                },
                function (error) {
                    $scope.isLoadingData = false;
                    // Error handling function when api fails
                    $scope.showInputLoader.show = false;
                    if (error.status === 500) {
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_NETWORK');
                        $scope.error('md');
                    } else if(error.status !== 200 && (error.xhrStatus === 'error' || error.xhrStatus === 'complete')) {
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_AUTOCOMPLETE_USERNAME');
                        $scope.error('md');
                    }
                });
            }else{
                $scope.isUserPermissionEmpty = true;
                $scope.isLoadingData = false;
            }
        }

        $scope.init = function () {
            if(!SessionStore.getItem("myVaultKey")){ /* Check if user is in the same session */
                $state.go('/');
                return;
            }
            getWorkloadDetails();
            $scope.appNameTableOptionsSort=[]
            $scope.certApplicationName = "";
            $scope.appNameSelected = false;
            var feature = JSON.parse(SessionStore.getItem("feature"));
            if (feature.selfservice == false && JSON.parse(SessionStore.getItem("isAdmin")) == false) {
                $state.go('manage');
            }
            $scope.safe = {
                name: '',
                owner: '',
                description: '',
                type: '',
                appName:''
            };
            $scope.dropDownOptions = {
                'selectedGroupOption': {"type": "Select Type"},       // As initial placeholder
                'tableOptions': $scope.tableOptions
            }  
                $scope.dropdownApplicationName = {
                        'selectedGroupOption': {"type": "Select Application Name"},       // As initial placeholder
                        'tableOptions':  $scope.appNameTableOptionsSort 
                    }

            $scope.allSafesList = JSON.parse(SessionStore.getItem("allSafes"));
            $scope.myVaultKey = SessionStore.getItem("myVaultKey");
            if(!$scope.myVaultKey){ /* Check if user is in the same session */
                $state.go('/');
            }
            $scope.disableAddBtn = true;
            $scope.userAutoCompleteEnabled = false;
            $scope.groupAutoCompleteEnabled = false;
            if (AppConstant.AD_USERS_AUTOCOMPLETE == true) {
                $scope.userAutoCompleteEnabled = true;
            }
            if (AppConstant.AD_GROUP_AUTOCOMPLETE == true) {
                $scope.groupAutoCompleteEnabled = true;
            }
            $scope.requestDataFrChangeSafe();
            $scope.fetchUsers();
            $scope.fetchGroups();
        }

        $scope.userNameValEmpty = false;
        $scope.grpNameValEmpty = false;

        $scope.fetchUsers = function () {

        }

        $scope.fetchGroups = function () {

        }
        $scope.enableEc2Controls = function (e) {
            angular.element(document.getElementById('bound_account_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_region'))[0].disabled = false;
            angular.element(document.getElementById('bound_vpc_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_subnet_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_ami_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_iam_instance_profile_arn'))[0].disabled = false;
            angular.element(document.getElementById('bound_iam_role_arn'))[0].disabled = false;
            angular.element(document.getElementById('bound_iam_principal_arn'))[0].disabled = true;
        }

        $scope.enableIamControls = function (e) {
            angular.element(document.getElementById('bound_account_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_region'))[0].disabled = true;
            angular.element(document.getElementById('bound_vpc_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_subnet_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_ami_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_iam_instance_profile_arn'))[0].disabled = true;
            angular.element(document.getElementById('bound_iam_role_arn'))[0].disabled = true;
            angular.element(document.getElementById('bound_iam_principal_arn'))[0].disabled = false;
        }

        $scope.addPermission = function (type, key, permission, editingPermission) {
            var duplicate = false;
            if (key !== null && key !== undefined) {
                if (type === "users" && !editingPermission) {
                    key = document.getElementById('addUser').value.toLowerCase();
                }
                if (type === "groups" && !editingPermission) {
                    key = document.getElementById('addGroup').value;
                }
                // extract only userId/groupId from key
                if (key.includes($scope.domainName)) {
                    key = key.split('@')[0];
                }
                if (type === "users" && key.includes("(")) {
                    key = key.substring(key.lastIndexOf("(") + 1, key.lastIndexOf(")"));
                }
            }
            if (!editingPermission && key != '' && key != undefined) {
                if (type === "users" && $scope.UsersPermissionsData!= null && $scope.UsersPermissionsData.hasOwnProperty(key.toLowerCase())) {
                    if ($scope.UsersPermissionsData[key.toLowerCase()] != "sudo") {
                        duplicate = true;
                    }
                }
                if (type === "groups" && $scope.GroupsPermissionsData!= null) {
                    var groupIndex = Object.keys($scope.GroupsPermissionsData).findIndex(function (groupName) {
                        return groupName.toLowerCase() === key.toLowerCase();
                    });
                    if(groupIndex > -1) {
                        duplicate = true;
                    }
                }
                if (type === "AWSPermission" && $scope.AwsPermissionsData.data!= null && $scope.AwsPermissionsData.data.hasOwnProperty(key.toLowerCase())) {
                    duplicate = true;
                }
                if (type === "AppRolePermission" && $scope.AppRolePermissionsData.data!= null && $scope.AppRolePermissionsData.data.hasOwnProperty(key.toLowerCase())) {
                    duplicate = true;
                }
            }
            if (duplicate) {
                clearInputPermissionData();
                $scope.errorMessage = 'Permission already exists! Select edit icon for update';
                $scope.error('md');
            }
            else if ((key != '' && key != undefined) || type == 'AwsRoleConfigure') {
                try {
                    Modal.close('');
                    $scope.isLoadingData = true;
                    $scope.showInputLoader.show = false;
                    $scope.showNoMatchingResults = false;
                    var setPath = $scope.getPath();
                    var apiCallFunction = '';
                    var reqObjtobeSent = {};
                    if ($scope.awsConfPopupObj.role !== null && $scope.awsConfPopupObj.role !== undefined) {
                        $scope.awsConfPopupObj.role = UtilityService.formatName($scope.awsConfPopupObj.role);
                    }
                    if ($scope.awsConfPopupObj.bound_region !== null && $scope.awsConfPopupObj.bound_region !== undefined) {
                        $scope.awsConfPopupObj.bound_region = UtilityService.formatName($scope.awsConfPopupObj.bound_region);
                    }
                    var updatedUrlOfEndPoint = "";
                    switch (type) {
                        case 'users':
                            apiCallFunction = AdminSafesManagement.addUserPermissionForSafe;
                            reqObjtobeSent = { "path": setPath, "username": key, "access": permission.toLowerCase() };
                            break;
                        case 'groups' :
                            apiCallFunction = AdminSafesManagement.addGroupPermissionForSafe;
                            reqObjtobeSent = {"path": setPath, "groupname": key, "access": permission.toLowerCase()};
                            break;
                        case 'AWSPermission' :
                            apiCallFunction = AdminSafesManagement.addAWSPermissionForSafe;
                            reqObjtobeSent = {"path": setPath, "role": key, "access": permission.toLowerCase()};
                            break;
                        case 'AwsRoleConfigure' :
                            $scope.awsConfPopupObj['policies'] = "";   // Todo: Because of unavailability of edit service, this has been put
                            if ($scope.editingAwsPermission.status == true) {
                                if ($scope.awsConfPopupObj.auth_type === 'ec2') {
                                    apiCallFunction = AdminSafesManagement.updateAWSRole;
                                    updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('updateAwsRole',"path="+setPath);
                                }
                                else {
                                    apiCallFunction = AdminSafesManagement.updateAWSIAMRole;
                                    updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('updateAwsIAMRole',"path="+setPath);
                                }
                            } else {
                                // Validate the input here if requried...
                                if ($scope.awsConfPopupObj.auth_type === 'ec2') {
                                    $scope.awsConfPopupObj.bound_iam_principal_arn = "";
                                    apiCallFunction = AdminSafesManagement.addAWSRole;
                                    updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('createAwsRole',"path="+setPath);
                                }
                                else {
                                    $scope.awsConfPopupObj['policies'] = [];
                                    $scope.awsConfPopupObj.bound_account_id = "";
                                    $scope.awsConfPopupObj.bound_region = "";
                                    $scope.awsConfPopupObj.bound_vpc_id = "";
                                    $scope.awsConfPopupObj.bound_subnet_id = "";
                                    $scope.awsConfPopupObj.bound_ami_id = "";
                                    $scope.awsConfPopupObj.bound_iam_instance_profile_arn = "";
                                    $scope.awsConfPopupObj.bound_iam_role_arn = "";
                                    var arn = [];
                                    arn.push($scope.awsConfPopupObj.bound_iam_principal_arn);
                                    $scope.awsConfPopupObj.bound_iam_principal_arn = arn;
                                    apiCallFunction = AdminSafesManagement.addAWSIAMRole;
                                    updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('createAwsIAMRole',"path="+setPath);
                                }
                               // apiCallFunction = AdminSafesManagement.addAWSRole;
                            }
                            reqObjtobeSent = $scope.awsConfPopupObj
                            break;
                        case 'AppRolePermission' :
                            apiCallFunction = AdminSafesManagement.addAppRolePermissionForSafe;
                            reqObjtobeSent = {"path": setPath, "role_name": key, "access": permission.toLowerCase()};
                            break;
                                }
                    apiCallFunction(reqObjtobeSent, updatedUrlOfEndPoint).then(function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    $scope.isLoadingData = false;
                                    if (type === 'AwsRoleConfigure') {
                                        $scope.addPermission('AWSPermission', $scope.awsConfPopupObj.role, permission, false);
                                    }
                                    else {
                                        $scope.requestDataFrChangeSafe();
                                        var notification = UtilityService.getAParticularSuccessMessage('MESSAGE_ADD_SUCCESS');
                                        if (key !== null && key !== undefined) {
                                            // if (type === "users" && key === SessionStore.getItem("username")) {
                                                clearInputPermissionData();
                                            //     return Modal.createModalWithController('stop.modal.html', {
                                            //         title: 'Permission changed',
                                            //         message: 'For security reasons, if you add or modify permission to yourself, you need to log out and log in again for the added or modified permissions to take effect.'
                                            //       });
                                            // }
                                            Notifications.toast(key + "'s permission" + notification);
                                        }
                                    }
                                } catch (e) {
                                    console.log(e);
                                    $scope.isLoadingData = false;
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                $scope.error('md');
                            }
                            clearInputPermissionData();
                            $scope.roleNameSelected = false;
                        },
                        function (error) {
                            // Error handling function
                            console.log(error);
                            document.getElementById('addUser').value = '';
                            if(error.status == "404"){
                                $scope.isLoadingData = false;
                                $scope.errorMessage = error.data.messages[0];
                                $scope.error('md');
                            }else{
                                clearInputPermissionData();
                                $scope.isLoadingData = false;
                                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                                $scope.error('md');
                            }
                           
                        })
                } catch (e) {
                    // To handle errors while calling 'fetchData' function
                    $scope.isLoadingData = false;
                    clearInputPermissionData();
                    console.log(e);
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                }
            }
        }

        $scope.newAwsConfiguration = function (size) {
            // To reset the aws configuration details object to create a new one
            $scope.editingAwsPermission = {"status": false};
            $scope.awsConfPopupObj = {
                "auth_type":"",
                "role": "",
                "bound_account_id": "",
                "bound_region": "",
                "bound_vpc_id": "",
                "bound_subnet_id": "",
                "bound_ami_id": "",
                "bound_iam_instance_profile_arn": "",
                "bound_iam_role_arn": "",
                "policies": "",
                "bound_iam_principal_arn": "",
                "resolve_aws_unique_ids": "false"
            };
            $scope.open(size);
        }

        $scope.addApproleToSafe = function (size) {
            // To reset the aws configuration details object to create a new one
            $scope.editingApprolePermission = {"status": false};
            $scope.approleConfPopupObj = {
                "token_max_ttl":"",
                "token_ttl": "",
                "role_name": "",
                "policies": "",
                "bind_secret_id": "",
                "secret_id_num_uses": "",
                "secret_id_ttl": "",
                "token_num_uses": ""
            };
            $scope.roleNameSelected = false;
            $scope.roleNameTableOptions = [];
            AdminSafesManagement.getApproles().then(function (response) {
                if (UtilityService.ifAPIRequestSuccessful(response)) {
                    var keys = response.data.keys +'';
                    var roles = keys.split(',');
                    for (var index = 0;index<roles.length;index++) {
                        $scope.roleNameTableOptions.push({"type":roles[index]});
                    }
                }
                else {
                    $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                    error('md');
                }
            },
            function (error) {
                // Error handling function
                console.log(error);
                $scope.isLoadingData = false;
                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                $scope.error('md');
            })

            $scope.dropDownRoleNames = {
                'selectedGroupOption': {"type": "Select Role Name"},       // As initial placeholder
                'tableOptions': $scope.roleNameTableOptions
            }
            $scope.openApprole(size);
        }

        /* TODO: What is open, functon name should be more descriptive */
        $scope.open = function (size) {
            Modal.createModal(size, 'changeSafePopup.html', 'ChangeSafeCtrl', $scope);
        };

        /* TODO: What is open, functon name should be more descriptive */
        $scope.openApprole = function (size) {
            Modal.createModal(size, 'appRolePopup.html', 'ChangeSafeCtrl', $scope);
        };

        /* TODO: What is ok, functon name should be more descriptive */
        $scope.ok = function () {
            Modal.close('ok');
            $scope.isLoadingData = false;
        };

        /* TODO: What is next, functon name should be more descriptive */
        $scope.next = function () {
            $scope.addAWSRoleSafe();
            // $scope.openAWSConfFinal('md');

        };

        /* TODO: What is cancel, functon name should be more descriptive */
        $scope.cancel = function () {
            Modal.close('close');
            $scope.isLoadingData = false;
        };

        // TO-BE-CHECKED : Function currently not in use

        //   $scope.getUsernamesAndGroups = function(){
        //       var url = "https://example.com/get-all-ad-users";
        //       var headers = {
        //           "authorization": "",
        //           "cache-control": "",
        //           "postman-token": ""
        //       }

        //       fetchData.getActionData(null, url, headers).then(
        //           function(response){
        //             console.log("All AD Users = ");
        //             console.log(response);
        //           },
        //           function(error){
        //               console.log("error = ");
        //               $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
        //               console.log(error);
        //           }
        //       );
        //   };

        $scope.transferSafeConfirmation =  function() {
            $scope.isAdmin = JSON.parse(SessionStore.getItem("isAdmin"));
            $scope.tansferSafe = {
                safeName: $scope.safe.name,
                safeType: $scope.safe.type,
                currentOwner: $scope.safe.owner,
                newOwnerEmail: ""
            }
            $scope.clearOwnerEmail();
            Modal.createModal('md', 'transferSafeConfirmation.html', 'ChangeSafeCtrl', $scope);
        }

        $scope.transferSafeForm =  function() {
            Modal.close('close');
            Modal.createModal('md', 'transferSafeForm.html', 'ChangeSafeCtrl', $scope);
        }

        $scope.searchEmail = function (searchVal) {
            if (searchVal.length > 2) {
                $scope.isUserSearchLoading = true;
                searchVal = searchVal.toLowerCase();
                try {
                    $scope.userSearchList = [];
                    var queryParameters = searchVal;
                    var updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('searchByUPNInGsmAndCorp', queryParameters);
                    return AdminSafesManagement.searchByUPNInGsmAndCorp(null, updatedUrlOfEndPoint).then(
                        function(response) {
                            $scope.isUserSearchLoading = false;
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                var filterdUserData = [];
                                $scope.userSearchList = response.data.data.values;
                                $scope.userSearchList.forEach(function (userData) {
                                    if (userData.userEmail != null && userData.userEmail.substring(0, searchVal.length).toLowerCase() == searchVal) {
                                        filterdUserData.push(userData);
                                    }
                                });
                                return orderByFilter(filterFilter(filterdUserData, searchVal), 'userEmail', true);
                            } else {
                                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                                $scope.error('md');
                            }
                        },
                        function(error) {
                            // Error handling function
                            console.log(error);
                            $scope.isUserSearchLoading = false;
                            $scope.tansferSafeEmailErrorMessage = "Email not found";
                    });
                } catch (e) {
                    console.log(e);
                    $scope.isUserSearchLoading = false;
                    clearSafeTransferRequest();
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                }
            }
        }

        $scope.ownerEmailValidation = function () {
            $scope.tansferSafeEmailErrorMessage = '';
            if ($scope.tansferSafe.newOwnerEmail == null || $scope.tansferSafe.newOwnerEmail == ""){
                $scope.safeTransferInValid = true;
            }
            if ($scope.tansferSafe.newOwnerEmail != null && $scope.tansferSafe.newOwnerEmail != undefined
                && $scope.tansferSafe.newOwnerEmail != "") {

                if ($scope.tansferSafe.currentOwner==$scope.tansferSafe.newOwnerEmail) {
                    $scope.tansferSafeEmailErrorMessage = "New owner email id should not be same as current owner email id"
                    $scope.safeTransferInValid = true;
                }
            }
        }

        $scope.selectOwnerforSafe = function (ownerEmail) {
            $scope.tansferSafeEmailErrorMessage = '';
            if (ownerEmail != null) {
                $scope.tansferSafe.newOwnerEmail = ownerEmail.userEmail;
                if ($scope.tansferSafe.newOwnerEmail != null && $scope.tansferSafe.newOwnerEmail != undefined
                        && $scope.tansferSafe.newOwnerEmail != "") {
                    if ($scope.tansferSafe.currentOwner==$scope.tansferSafe.newOwnerEmail) {
                        $scope.tansferSafeEmailErrorMessage = "New owner email id should not be same as current owner email id"
                        $scope.safeTransferInValid = true;
                        $scope.isOwnerSelected = false;
                    }
                    else{
                        $scope.safeTransferInValid = false;
                        $scope.isOwnerSelected = true;
                    }
                }
            }
        }

        $scope.clearOwnerEmail = function () {
            $scope.tansferSafe.newOwnerEmail = "";
            $scope.isOwnerSelected = false;
            $scope.tansferSafeEmailErrorMessage = "";
        }

        function clearSafeTransferRequest () {
            $scope.tansferSafe = {
                safeName: null,
                safeType: null,
                currentOwner: null,
                newOwnerEmail: ""
            }
            $scope.isTransferInProgress = false;
        }

        $scope.transferSafe = function () {
            Modal.close('close');
            $scope.isLoadingData = true;
            $scope.isTransferInProgress = true;
            var safeType = "users";
            switch ($scope.tansferSafe.safeType) {
                case "Application Safe":
                    safeType = 'apps';
                    break;
                case "User Safe":
                    safeType = 'users';
                    break;
                case "Shared Safe":
                default:
                    safeType = 'shared';
                    break;
            }
            var transferRequest = {
                newOwnerEmail: $scope.tansferSafe.newOwnerEmail,
                safeName: $scope.tansferSafe.safeName,
                safeType: safeType
            }
            AdminSafesManagement.transferSafe(transferRequest, null).then(function (response) {
                $scope.isLoadingData = false;
                if (UtilityService.ifAPIRequestSuccessful(response)) {
                    $scope.transferSafeSuccess();
                }
                else {
                    $scope.transferSafeFailed();
                }
            },
            function (error) {
                // Error handling function
                console.log(error);
                $scope.isLoadingData = false;
                clearSafeTransferRequest();
                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                $scope.error('md');
            })
        }

        $scope.transferSafeSuccess =  function() {
            Modal.close('close');
            Modal.createModal('md', 'transferSafeSuccess.html', 'ChangeSafeCtrl', $scope);
        }

        $scope.transferSafeFailed =  function() {
            Modal.close('close');
            Modal.createModal('md', 'transferSafeFailed.html', 'ChangeSafeCtrl', $scope);
        }

        $scope.closeSafeTransfer = function () {
            clearSafeTransferRequest();
            $scope.goBack();
        }

        $scope.init();

    });
})(angular.module('vault.features.ChangeSafeCtrl', [
    'vault.services.AdminSafesManagement',
    'vault.services.ModifyUrl',
    'vault.constants.AppConstant'
]));
