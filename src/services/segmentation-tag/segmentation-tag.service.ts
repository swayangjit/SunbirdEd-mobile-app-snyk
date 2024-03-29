import {Inject, Injectable} from '@angular/core';
import {PreferenceKey, ProfileConstants} from '../../app/app.constant';
import {
    AuthService,
    DebuggingService,
    Profile,
    ProfileService,
    SegmentationService,
    SharedPreferences
} from '@project-sunbird/sunbird-sdk';
import {AppGlobalService} from '../app-global-service.service';
import {NotificationService} from '../../services/notification.service';
import {FormAndFrameworkUtilService} from '../formandframeworkutil.service';
import {SplaschreenDeeplinkActionHandlerDelegate} from '../sunbird-splashscreen/splaschreen-deeplink-action-handler-delegate';
import {FormConstants} from '../../app/form.constants';
import {Events} from '../../util/events';

export class TagPrefixConstants {
    static readonly DEVICE_CONFIG = 'DEVCONFIG_';
    static readonly USER_ATRIBUTE = 'USERFRAMEWORK_';
    static readonly USER_LOCATION = 'USERLOCATION_';
    static readonly CONTENT_ID = 'CONTENT_';
    static readonly USER_LANG = 'USERLANG_';
    static readonly ALL = 'ALL_';
    static readonly USER_ROLE = 'USERROLE_';
    static readonly APP_VER = 'APPVERSION_';
}

export class CommandFunctions {
    static readonly LOCAL_NOTIFICATION = 'LOCAL_NOTIF';
    static readonly BANNER = 'BANNER_CONFIG';
    static readonly DEBUGGING = 'DEBUGGING_MODE';
}

@Injectable()
export class SegmentationTagService {

    private _localNotificationId: number;
    public exeCommands = [];

    private comdList = [];

    set localNotificationId(id) {
        this._localNotificationId = id;
    }

    get localNotificationId() {
        return this._localNotificationId;
    }

    constructor(
        @Inject('SEGMENTATION_SERVICE') private segmentationService: SegmentationService,
        @Inject('PROFILE_SERVICE') private profileService: ProfileService,
        @Inject('AUTH_SERVICE') private authService: AuthService,
        @Inject('SHARED_PREFERENCES') private preferences: SharedPreferences,
        @Inject('DEBUGGING_SERVICE') private debugginService: DebuggingService,
        private notificationSrc: NotificationService,
        private appGlobalService: AppGlobalService,
        private formAndFrameworkUtilService: FormAndFrameworkUtilService,
        private splaschreenDeeplinkActionHandlerDelegate: SplaschreenDeeplinkActionHandlerDelegate,
        private events: Events
    ) {
    }

    persistSegmentation() {
        this.profileService.getActiveSessionProfile({requiredFields: ProfileConstants.REQUIRED_FIELDS}).toPromise()
            .then((userProfile: Profile) => {
                if (userProfile && userProfile.uid) {
                    console.log(this);

                    this.segmentationService.saveTags(JSON.stringify(window['segmentation'].SBTagService), userProfile.uid)
                        .subscribe(response => {
                            console.log(response);
                            if (response) {
                                window['segmentation'].SBTagService.removeAllTags();
                            }
                        });
                    this.segmentationService.saveCommandList(JSON.stringify(this.exeCommands), userProfile.uid).subscribe(response => {
                        console.log(response);
                        if (response) {
                            this.exeCommands = [] 
                        }
                    });
                }
            }).catch(err => console.error(err));
    }

    getPersistedSegmentaion() {
        this.profileService.getActiveSessionProfile({requiredFields: ProfileConstants.REQUIRED_FIELDS}).toPromise()
            .then((userProfile: Profile) => {
                if (userProfile && userProfile.uid) {
                    this.segmentationService.getTags(userProfile.uid)
                        .subscribe(response => {
                            if (response) {
                                window['segmentation'].SBTagService.restoreTags(response);
                            }
                        });

                    this.segmentationService.getCommand(userProfile.uid)
                        .subscribe(cmdList => {
                            if (cmdList) {
                                this.exeCommands = JSON.parse(cmdList);
                            }
                            this.getSegmentCommand(userProfile.syllabus[0]);
                        });
                }
            }).catch(err => console.error(err));
    }

    async getSegmentCommand(frameworkId?) {
        // FormConfig for Segment
        let rootOrgId = await this.preferences.getString('defaultRootOrgId').toPromise();
        await this.formAndFrameworkUtilService.getFormFields({...FormConstants.SEGMENTATION, framework: frameworkId, rootOrgId}, rootOrgId)
        .then(async cmdList => {
            if (cmdList && cmdList.length) {
                this.comdList = cmdList.filter(v => !v.targetedClient);
                await this.evalCriteria();
            }
        }).catch(err => console.error(err));
    }

    async evalCriteria() {
        const validCommand = window['segmentation'].SBActionCriteriaService.evaluateCriteria(
            window['segmentation'].SBTagService.__tagList,
            this.comdList
        );
        await this.executeCommand(validCommand);
        await this.evalExecutedCommands();
    }

    async executeCommand(validCmdList, revert?) {
        /*
        ** check if command already exist in command list
        ** check if command already executed, then do nothing
        ** if new command then execute command and store it in executedCommandList
        */
        const selectedLanguage = await this.preferences.getString(PreferenceKey.SELECTED_LANGUAGE_CODE).toPromise();
        for (const cmdCriteria of validCmdList) {
            if (!this.exeCommands.find(ele => ele.commandId === cmdCriteria.commandId)) {
                switch (cmdCriteria.controlFunction) {
                    case CommandFunctions.LOCAL_NOTIFICATION:
                        await this.notificationSrc.setupLocalNotification(selectedLanguage, cmdCriteria.controlFunctionPayload);
                        this.exeCommands.push(cmdCriteria);
                        break;
                    case CommandFunctions.BANNER:
                        if (cmdCriteria.controlFunctionPayload && cmdCriteria.controlFunctionPayload.showBanner && !revert) {
                            this.exeCommands.push(cmdCriteria);
                        }
                        break;
                    case CommandFunctions.DEBUGGING:
                        if (cmdCriteria.controlFunctionPayload && cmdCriteria.controlFunctionPayload.traceId && !revert) {
                            this.exeCommands.push(cmdCriteria);
                            await this.preferences.putString('debug_started_at', new Date().getTime().toString()).toPromise();
                            this.debugginService.enableDebugging(cmdCriteria.controlFunctionPayload.traceId)
                                .subscribe((isDebugMode) => {
                                    this.events.publish('debug_mode', isDebugMode);
                                });
                        }
                        break;
                    default:
                        break;
                }
            }
        }
        this.handleLocalNotificationTap();
    }

    handleLocalNotificationTap() {
        let payloadData;
        if (this._localNotificationId) {
            payloadData = this.exeCommands.find((ele) => {
                return ele.controlFunctionPayload[0].config[0].id === this._localNotificationId;
            }).controlFunctionPayload[0].config;
            this.splaschreenDeeplinkActionHandlerDelegate.onAction(payloadData[0]);
            this.localNotificationId = null;
        }
    }

    async evalExecutedCommands() {
        const validCommand = window['segmentation'].SBActionCriteriaService.evaluateCriteria(
            window['segmentation'].SBTagService.__tagList,
            this.exeCommands
        );
        const invalidcomd = this.exeCommands.filter(exeCmd => !validCommand.some(validCmd => validCmd.commandId === exeCmd.commandId));
        for (let i = (invalidcomd.length - 1); i >= 0; i--) {
            this.exeCommands.splice(this.exeCommands.indexOf(invalidcomd[i]), 1);
        }
        await this.executeCommand(invalidcomd, true);
    }

    async createSegmentTags(res) {
        Object.keys(res).forEach((key) => {
            res[key] = res[key].map(x => x.replace(/\s/g, '').toLowerCase())
        })
        window['segmentation'].SBTagService.pushTag(res, TagPrefixConstants.USER_ATRIBUTE, true);
        await this.evalCriteria();
      }
    
      async refreshSegmentTags(profile) {
          Object.keys(profile).forEach((key) => {
              if (!Array.isArray(profile[key])) {
                  profile[key] = [profile[key]]
              }
            profile[key] = profile[key].map(x => x.replace(/\s/g, '').toLowerCase())
        })
        window['segmentation'].SBTagService.pushTag(profile, TagPrefixConstants.USER_ATRIBUTE, true);
        await this.evalCriteria();
    }
}

function SEGMENTATION(SEGMENTATION: any) {
    throw new Error('Function not implemented.');
}

