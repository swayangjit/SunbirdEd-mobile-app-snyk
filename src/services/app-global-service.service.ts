import { Inject, Injectable, OnDestroy } from '@angular/core';
import { animationGrowInTopRight } from '../app/animations/animation-grow-in-top-right';
import { animationShrinkOutTopRight } from '../app/animations/animation-shrink-out-top-right';
import { UpgradePopoverComponent } from '../app/components/popups/upgrade-popover/upgrade-popover.component';
import { JoyfulThemePopupComponent } from '../app/components/popups/joyful-theme-popup/joyful-theme-popup.component';
import { SbTutorialPopupComponent } from '../app/components/popups/sb-tutorial-popup/sb-tutorial-popup.component';
import { NewExperiencePopupComponent } from '../app/components/popups/new-experience-popup/new-experience-popup.component';
import { EventParams } from '../app/components/sign-in-card/event-params.interface';
import { AppVersion } from '@awesome-cordova-plugins/app-version/ngx';
import { PopoverController } from '@ionic/angular';
import { Events } from '../util/events';
import { Observable, Observer } from 'rxjs';
import {
    AuthService, Course, Framework, FrameworkCategoryCodesGroup, FrameworkDetailsRequest, FrameworkService,
    OAuthSession, Profile, ProfileService, ProfileSession, ProfileType, SharedPreferences
} from '@project-sunbird/sunbird-sdk';
import { GenericAppConfig, PreferenceKey, ProfileConstants } from '../app/app.constant';
import { PermissionAsked } from './android-permissions/android-permission';
import { Environment, ID, InteractSubtype, InteractType, PageId } from './telemetry-constants';
import { TelemetryGeneratorService } from './telemetry-generator.service';
import { UtilityService } from './utility-service';
import { YearOfBirthPopupComponent } from '../app/components/popups/year-of-birth-popup/year-of-birth-popup.component';

@Injectable({
    providedIn: 'root'
})
export class AppGlobalService implements OnDestroy {
    public static readonly USER_INFO_UPDATED = 'user-profile-changed';
    public static readonly PROFILE_OBJ_CHANGED = 'app-global:profile-obj-changed';
    public static isPlayerLaunched = false;

    session: OAuthSession;

    /**
     * This property stores the courses enrolled by a user
     */
    courseList: Array<Course>;

    /**
     * This property stores the course filter configuration at the app level for a particular app session
     */
    courseFilterConfig: Array<any> = [];

    /**
     * This property stores the library filter configuration at the app level for a particular app session
     */
    libraryFilterConfig: Array<any> = [];

    /**
     * This property stores the location configuration at the app level for a particular app session
     */
    locationConfig: Array<any> = [];

    /**
     * This property stores the Supported Url configuration at the app level for non standard deeplinks
     */
    supportedUrlRegexConfig?: any;

    /**
     * This property stores the organization at the app level for a particular app session
     */
    rootOrganizations: Array<any>;
    courseFrameworkId: string;

    currentPageId: string;
    pdfPlayerConfiguratiion: boolean;

    guestUserProfile: Profile;
    isGuestUser = false;
    guestProfileType: ProfileType;
    isProfileSettingsCompleted: boolean;
    isOnBoardingCompleted = false;
    selectedUser;
    selectedBoardMediumGrade: string;
    isPermissionAsked: PermissionAsked = {
        isCameraAsked: false,
        isStorageAsked: false,
        isRecordAudioAsked: false,
    };
    private _limitedShareQuizContent: any;
    private _isSignInOnboardingCompleted: any;
    private isJoinTraningOnboarding: any;
    private _signinOnboardingLoader: any;
    private _skipCoachScreenForDeeplink = false;
    private _preSignInData: any;
    private _generateCourseCompleteTelemetry = false;
    private _generateCourseUnitCompleteTelemetry = false;
    private _showCourseCompletePopup = false;
    private _formConfig: any;
    private _selectedActivityCourseId: string;
    private _redirectUrlAfterLogin: string;
    private _isNativePopupVisible: boolean;
    private _isDiscoverBackEnabled: boolean = false;
    private _isForumEnabled: boolean = false;
    private frameworkCategory: any;
    private _isSplashscreenDisplay: boolean = false;
    private requiredCategories: Array<string> = [];

    constructor(
        @Inject('PROFILE_SERVICE') private profile: ProfileService,
        @Inject('AUTH_SERVICE') public authService: AuthService,
        @Inject('FRAMEWORK_SERVICE') private frameworkService: FrameworkService,
        @Inject('SHARED_PREFERENCES') private preferences: SharedPreferences,
        private event: Events,
        private popoverCtrl: PopoverController,
        private telemetryGeneratorService: TelemetryGeneratorService,
        private utilityService: UtilityService,
        private appVersion: AppVersion
    ) {

        this.initValues();
        this.listenForEvents();
    }
    public averageTime = 0;
    public averageScore = 0;
    private frameworkData = [];
    public SUPPORT_EMAIL = 'support@sunbird.com';

    isUserLoggedIn(): boolean {
        return !this.isGuestUser;
    }

    getGuestUserType(): ProfileType {
        return this.guestProfileType;
    }

    getCurrentUser(): Profile {
        return this.guestUserProfile;
    }

    getSessionData(): any {
        return this.session;
    }

    getSelectedUser() {
        return this.selectedUser;
    }

    setSelectedUser(selectedUser) {
        this.selectedUser = selectedUser;
    }

    getNameForCodeInFramework(category, code) {
        let name;

        if (this.frameworkData[category]
            && this.frameworkData[category].terms
            && this.frameworkData[category].terms.length > 0) {
            const matchingTerm = this.frameworkData[category].terms.find((term) => {
                return term.code === code;
            });

            if (matchingTerm) {
                name = matchingTerm.name;
            }
        }

        return name;
    }


    setpdfPlayerconfiguration(config) {
        this.pdfPlayerConfiguratiion = config;
    }

    getPdfPlayerConfiguration() {
        return this.pdfPlayerConfiguratiion;
    }

    /**
     * This method stores the list of courses enrolled by user, and is updated every time
     * getEnrolledCourses is called.
     */
    setEnrolledCourseList(courseList: Array<any>) {
        this.courseList = courseList;
    }

    /**
     * This method returns the list of enrolled courses
     */
    getEnrolledCourseList(): Array<any> {
        return this.courseList;
    }

    /**
     * This method stores the course filter config, for a particular session of the app
     */
    setCourseFilterConfig(courseFilterConfig: Array<any>) {
        this.courseFilterConfig = courseFilterConfig;
    }

    /**
     * This method returns the course filter config cache, for a particular session of the app
     */
    getCachedCourseFilterConfig(): Array<any> {
        return this.courseFilterConfig;
    }

    /**
     * This method stores the library filter config, for a particular session of the app
     */
    setLibraryFilterConfig(libraryFilterConfig: Array<any>) {
        this.libraryFilterConfig = libraryFilterConfig;
    }

    /**
     * This method returns the library filter config cache, for a particular session of the app
     */
    getCachedLibraryFilterConfig(): Array<any> {
        return this.libraryFilterConfig;
    }

    /**
     * This method stores the location config, for a particular session of the app
     */
    setLocationConfig(locationConfig: Array<any>) {
        this.locationConfig = locationConfig;
    }

    /**
     * This method returns the location config cache, for a particular session of the app
     */
    getCachedLocationConfig(): Array<any> {
        return this.locationConfig;
    }

    /**
     * This method returns the cached Supported url regex config
     */
    getCachedSupportedUrlRegexConfig(): any {
        return this.supportedUrlRegexConfig;
    }

    /**
     * This method stores the Supported url regex config, for a non standard supported url regex
     */
    setSupportedUrlRegexConfig(supportedUrlRegexConfig: any) {
        this.supportedUrlRegexConfig = supportedUrlRegexConfig;
    }

    /**
     * This method stores the rootOrganizations, for a particular session of the app
     */
    setRootOrganizations(rootOrganizations: Array<any>) {
        this.rootOrganizations = rootOrganizations;
    }

    /**
     * This method returns the rootOrganizations cache, for a particular session of the app
     */
    getCachedRootOrganizations(): Array<any> {
        return this.rootOrganizations;
    }

    /**
     * This method stores the courseFrameworkId, for a particular session of the app
     */
    setCourseFrameworkId(courseFrameworkId: string) {
        this.courseFrameworkId = courseFrameworkId;
    }

    /**
     * This method returns the courseFrameworkId cache, for a particular session of the app
     */
    getCachedCourseFrameworkId(): string {
        return this.courseFrameworkId;
    }

    /**
     * This method store the Framework Category
     */
    setFramewokCategory(categories: any) {
        this.frameworkCategory = categories;
    }

    /** This method return the framework categories if available */
    getCachedFrameworkCategory(): any {
        return this.frameworkCategory;
    }

    setRequiredCategories(categories: []) {
        this.requiredCategories = categories;
    }

    getRequiredCategories(): any {
        return this.requiredCategories;
    }

    /**
     * @returns UserId or empty string if not available
     * getLoggedinUserId
     */
    getUserId(): string | undefined {
        if (!this.session) {
            this.authService.getSession().toPromise()
                .then((session) => {
                    this.session = session;
                }).catch(() => {});
        }

        if (this.session) {
            return this.session.userToken;
        }

        return undefined;
    }

    readConfig() {
        this.utilityService.getBuildConfigValue(GenericAppConfig.SUPPORT_EMAIL)
            .then(response => {
                this.SUPPORT_EMAIL = response;
            })
            .catch(() => {
                this.SUPPORT_EMAIL = '';
            });
    }

    async setOnBoardingCompleted() {
        const session = await this.authService.getSession().toPromise();
        if (!session) {
            this.isOnBoardingCompleted = true;
            await this.preferences.putString(PreferenceKey.IS_ONBOARDING_COMPLETED, 'true').toPromise().then();
        }
    }

    private async initValues(eventParams?: EventParams) {
        this.readConfig();
        /* to make sure there are no duplicate calls to getSession and profile setting
         * from login flow only eventParams are received via events
         */
        if (!eventParams || (eventParams && !eventParams.skipSession)) {
            let session = await this.authService.getSession().toPromise();
            if (!session) {
                this.isGuestUser = true;
                this.session = session;
                this.getGuestUserInfo()
            } else {
                this.guestProfileType = undefined;
                this.isGuestUser = false;
                this.session = session;
            }
            this.getCurrentUserProfile(eventParams);
        }
        this.preferences.getString(PreferenceKey.IS_ONBOARDING_COMPLETED).toPromise().then((result) => {
            this.isOnBoardingCompleted = (result === 'true') ? true : false;
        }).catch(e => console.log(e))
    }

    private getCurrentUserProfile(eventParams?: EventParams) {
        if (!eventParams || (eventParams && !eventParams.skipProfile)) {
            this.profile.getActiveSessionProfile({ requiredFields: ProfileConstants.REQUIRED_FIELDS }).toPromise()
                .then(async (response: Profile) => {
                    this.guestUserProfile = response;
                    if (this.guestUserProfile.syllabus && this.guestUserProfile.syllabus.length > 0) {
                        this.getFrameworkDetails(this.guestUserProfile.syllabus[0])
                            .then((categories) => {
                                categories.forEach(category => {
                                    this.frameworkData[category.code] = category;
                                });

                                this.event.publish(AppGlobalService.PROFILE_OBJ_CHANGED);
                            }).catch(() => {
                                this.frameworkData = [];
                                this.event.publish(AppGlobalService.PROFILE_OBJ_CHANGED);
                            });
                        await this.getProfileSettingsStatus();
                    } else {
                        this.frameworkData = [];
                        this.event.publish(AppGlobalService.PROFILE_OBJ_CHANGED);
                    }
                })
                .catch((error) => {
                    console.error(error);
                    this.guestUserProfile = undefined;
                    this.event.publish(AppGlobalService.PROFILE_OBJ_CHANGED);
                });
        }
    }

    // Remove this method after refactoring formandframeworkutil.service
    private getFrameworkDetails(frameworkId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const frameworkDetailsRequest: FrameworkDetailsRequest = {
                frameworkId: frameworkId || '',
                requiredCategories: FrameworkCategoryCodesGroup.DEFAULT_FRAMEWORK_CATEGORIES
            };
            this.frameworkService.getFrameworkDetails(frameworkDetailsRequest).toPromise()
                .then((framework: Framework) => {
                    resolve(framework.categories);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    public getGuestUserInfo(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.preferences.getString(PreferenceKey.SELECTED_USER_TYPE).toPromise()
                .then(val => {
                    if (val) {
                        if (val === ProfileType.STUDENT) {
                            this.guestProfileType = ProfileType.STUDENT;
                        } else if (val === ProfileType.TEACHER) {
                            this.guestProfileType = ProfileType.TEACHER;
                        } else if (val === ProfileType.OTHER) {
                            this.guestProfileType = ProfileType.OTHER;
                        } else if (val === ProfileType.ADMIN) {
                            this.guestProfileType = ProfileType.ADMIN;
                        } else if (val === ProfileType.PARENT) {
                            this.guestProfileType = ProfileType.PARENT;
                        }
                        this.isGuestUser = true;
                        resolve(this.guestProfileType);
                    }
                }).catch(() => {
                    reject();
                });
        });
    }

    private listenForEvents() {
        this.event.subscribe(AppGlobalService.USER_INFO_UPDATED, async () => {
            await this.initValues();
        });

        this.event.subscribe('refresh:profile', async () => {
            await this.initValues();
        });

        this.event.subscribe('refresh:loggedInProfile', async () => {
            await this.initValues();
        });

    }

    async openPopover(upgradeData: any) {
        let shouldDismissAlert = true;

        if (upgradeData.type === 'force' || upgradeData.type === 'forced') {
            shouldDismissAlert = false;
        }

        const options = {
            component: UpgradePopoverComponent,
            componentProps: { upgrade: upgradeData },
            cssClass: 'upgradePopover',
            showBackdrop: true,
            backdropDismiss: shouldDismissAlert
        };

        const popover = await this.popoverCtrl.create(options);
        await popover.present();

        await popover.onDidDismiss().then(() => {
            this.telemetryGeneratorService.generateInteractTelemetry(
                InteractType.BACKDROP_DISMISSED,
                '',
                upgradeData.isOnboardingCompleted ? Environment.HOME : Environment.ONBOARDING,
                PageId.UPGRADE_POPUP,
                undefined,
                undefined,
                undefined,
                undefined,
                ID.BACKDROP_CLICKED
            );
        });
    }

    generateConfigInteractEvent(pageId: string, isOnBoardingCompleted?: boolean) {
        if (this.isGuestUser) {
            const paramsMap = new Map();
            if (pageId !== PageId.PROFILE) {
                paramsMap['isProfileSettingsCompleted'] = isOnBoardingCompleted;
            }

            this.telemetryGeneratorService.generateInteractTelemetry(InteractType.OTHER,
                InteractSubtype.INITIAL_CONFIG,
                Environment.HOME,
                pageId,
                undefined,
                paramsMap
            );
        }
    }

    generateAttributeChangeTelemetry(oldAttribute, newAttribute, pageId, env?) {
            const values = new Map();
            values['oldValue'] = oldAttribute;
            values['newValue'] = newAttribute;

            this.telemetryGeneratorService.generateInteractTelemetry(InteractType.TOUCH,
                InteractSubtype.PROFILE_ATTRIBUTE_CHANGED,
                env ? env : Environment.USER,
                pageId,
                undefined,
                values);
    }

    generateSaveClickedTelemetry(profile, validation, pageId, interactSubtype) {
            const values = new Map();
            values['profile'] = profile;
            values['validation'] = validation;

            this.telemetryGeneratorService.generateInteractTelemetry(InteractType.TOUCH,
                interactSubtype,
                Environment.USER,
                pageId,
                undefined,
                values);
    }

    getPageIdForTelemetry() {
        let pageId = PageId.LIBRARY;
        if (this.currentPageId) {
            switch (this.currentPageId.toLowerCase()) {
                case 'library':
                    pageId = PageId.LIBRARY;
                    break;
                case 'courses':
                    pageId = PageId.COURSES;
                    break;
                case 'profile':
                    pageId = PageId.PROFILE;
                    break;
                case 'downloads':
                    pageId = PageId.DOWNLOADS;
                    break;
            }
        }
        return pageId;
    }

    setAverageTime(time) {
        this.averageTime = time;
    }

    getAverageTime() {
        return this.averageTime;
    }

    setAverageScore(averageScore: any): any {
        this.averageScore = averageScore;
    }

    getAverageScore() {
        return this.averageScore;
    }

    getProfileSettingsStatus(profileDetails?): Promise<any> {
        return new Promise((resolve, reject) => {
            let profile = this.getCurrentUser();
            if (profileDetails) {
                profile = profileDetails;
            }
            this.isProfileSettingsCompleted = Boolean(this.isGuestUser
                && profile
                && profile.syllabus && profile.syllabus[0]
                && profile.board && profile.board.length
                && profile.grade && profile.grade.length
                && profile.medium && profile.medium.length);
            resolve(this.isProfileSettingsCompleted);
        });
    }


    ngOnDestroy() {
        this.event.unsubscribe(AppGlobalService.USER_INFO_UPDATED);
        this.event.unsubscribe('refresh:profile');
    }

    setSelectedBoardMediumGrade(selectedBoardMediumGrade: string): void {
        this.selectedBoardMediumGrade = selectedBoardMediumGrade;
    }

    getSelectedBoardMediumGrade(): string {
        return this.selectedBoardMediumGrade;
    }

    getIsPermissionAsked(key: string): Observable<boolean> {
        return Observable.create((observer: Observer<boolean>) => {

            this.preferences.getString(PreferenceKey.APP_PERMISSION_ASKED).subscribe(
                async (permissionAsked: string | undefined) => {
                    if (!permissionAsked) {
                        await this.preferences.putString(
                            PreferenceKey.APP_PERMISSION_ASKED, JSON.stringify(this.isPermissionAsked)).toPromise().then();
                        observer.next(false);
                        observer.complete();
                        return;
                    } else {
                        observer.next(JSON.parse(permissionAsked)[key]);
                        observer.complete();
                        return;
                    }
                });
        });
    }

    setIsPermissionAsked(key: string, value: boolean): void {

        this.preferences.getString(PreferenceKey.APP_PERMISSION_ASKED).subscribe(
            async (permissionAsked: string | undefined) => {
                if (!permissionAsked) {
                    await this.preferences.putString(
                        PreferenceKey.APP_PERMISSION_ASKED, JSON.stringify(this.isPermissionAsked)).toPromise().then();
                    return;
                } else {
                    permissionAsked = JSON.parse(permissionAsked);
                    permissionAsked[key] = value;
                    await this.preferences.putString(PreferenceKey.APP_PERMISSION_ASKED, JSON.stringify(permissionAsked)).toPromise().then();
                    return;
                }
            });
    }

    get limitedShareQuizContent() {
        return this._limitedShareQuizContent;
    }

    set limitedShareQuizContent(value) {
        this._limitedShareQuizContent = value;
    }

    get isSignInOnboardingCompleted() {
        return this._isSignInOnboardingCompleted;
    }

    set isSignInOnboardingCompleted(value) {
        this._isSignInOnboardingCompleted = value;
    }
    get isJoinTraningOnboardingFlow() {
        return this.isJoinTraningOnboarding;
    }

    set isJoinTraningOnboardingFlow(value) {
        this.isJoinTraningOnboarding = value;
    }

    get signinOnboardingLoader() {
        return this._signinOnboardingLoader;
    }
    set signinOnboardingLoader(value) {
        this._signinOnboardingLoader = value;
    }

    get skipCoachScreenForDeeplink() {
        return this._skipCoachScreenForDeeplink;
    }
    set skipCoachScreenForDeeplink(value) {
        this._skipCoachScreenForDeeplink = value;
    }

    get preSignInData() {
        return this._preSignInData;
    }
    set preSignInData(value) {
        this._preSignInData = value;
    }

    get generateCourseCompleteTelemetry() {
        return this._generateCourseCompleteTelemetry;
    }
    set generateCourseCompleteTelemetry(value) {
        this._generateCourseCompleteTelemetry = value;
    }

    get generateCourseUnitCompleteTelemetry() {
        return this._generateCourseUnitCompleteTelemetry;
    }
    set generateCourseUnitCompleteTelemetry(value) {
        this._generateCourseUnitCompleteTelemetry = value;
    }

    get showCourseCompletePopup() {
        return this._showCourseCompletePopup;
    }

    set showCourseCompletePopup(value) {
        this._showCourseCompletePopup = value;
    }

    get formConfig() {
        return this._formConfig;
    }

    set formConfig(value) {
        this._formConfig = value;
    }

    get selectedActivityCourseId() {
        return this._selectedActivityCourseId;
    }

    set selectedActivityCourseId(value) {
        this._selectedActivityCourseId = value;
    }

    get redirectUrlAfterLogin() {
        return this._redirectUrlAfterLogin;
    }

    set redirectUrlAfterLogin(value) {
        this._redirectUrlAfterLogin = value;
    }

    get isNativePopupVisible() {
        return this._isNativePopupVisible;
    }

    set isNativePopupVisible(value) {
        this._isNativePopupVisible = value;
    }

    get isDiscoverBackEnabled() {
        return this._isDiscoverBackEnabled;
    }

    set isDiscoverBackEnabled(value) {
        this._isDiscoverBackEnabled = value;
    }

    set isForumEnabled(value) {
        this._isForumEnabled = value;
    }

    get isForumEnabled() {
        return this._isForumEnabled;
    }

    set isSplashscreenDisplay(value) {
        this._isSplashscreenDisplay = value;
    }

    get isSplashscreenDisplay() {
        return this._isSplashscreenDisplay;
    }

    setNativePopupVisible(value, timeOut?) {
        if (timeOut) {
            setTimeout(() => {
                this._isNativePopupVisible = value;
            }, timeOut);
        } else {
            this._isNativePopupVisible = value;
        }
    }


    // This method is used to reset if any quiz content data is previously saved before Joining a Training
    // So it wont affect in the exterId verification page
    resetSavedQuizContent() {
        this.limitedShareQuizContent = null;
    }

    async closeSigninOnboardingLoader() {
        if (this.signinOnboardingLoader) {
            await this.signinOnboardingLoader.dismiss();
            this.signinOnboardingLoader = null;
        }
    }

    async showTutorialScreen() {
        if (this.skipCoachScreenForDeeplink) {
            this.skipCoachScreenForDeeplink = false;
        } else {
            const tutorialScreen = await this.preferences.getBoolean(PreferenceKey.COACH_MARK_SEEN).toPromise();
            if (!tutorialScreen) {
                const appLabel = await this.appVersion.getAppName();
                const tutorialPopover = await this.popoverCtrl.create({
                    component: SbTutorialPopupComponent,
                    componentProps: { appLabel },
                    showBackdrop: true,
                    backdropDismiss: false,
                    enterAnimation: animationGrowInTopRight,
                    leaveAnimation: animationShrinkOutTopRight
                });
                await tutorialPopover.present();
                await this.preferences.putBoolean(PreferenceKey.COACH_MARK_SEEN, true).toPromise().then();
            }
        }
    }

    async showJoyfulPopup() {
        if (this.skipCoachScreenForDeeplink) {
            this.skipCoachScreenForDeeplink = false;
        } else {
            const isPopupDisplayed = await this.preferences.getBoolean(PreferenceKey.IS_JOYFUL_THEME_POPUP_DISPLAYED).toPromise();
            if (!isPopupDisplayed) {
                const appLabel = await this.appVersion.getAppName();
                const newThemePopover = await this.popoverCtrl.create({
                    component: JoyfulThemePopupComponent,
                    componentProps: { appLabel },
                    backdropDismiss: false,
                    showBackdrop: true,
                    cssClass: 'sb-new-theme-popup'
                });
                await newThemePopover.present();
                await this.preferences.putBoolean(PreferenceKey.IS_JOYFUL_THEME_POPUP_DISPLAYED, true).toPromise().then();
            }
            await this.preferences.putBoolean(PreferenceKey.COACH_MARK_SEEN, true).toPromise().then();
        }
    }

    async showNewTabsSwitchPopup() {
        const isPopupDisplayed = await this.preferences.getString(PreferenceKey.SELECTED_SWITCHABLE_TABS_CONFIG).toPromise();
        if (!isPopupDisplayed) {
            const appLabel = await this.appVersion.getAppName();
            const newThemePopover = await this.popoverCtrl.create({
                component: NewExperiencePopupComponent,
                componentProps: { appLabel },
                backdropDismiss: false,
                showBackdrop: true,
                cssClass: 'sb-switch-new-experience-popup'
            });
            await newThemePopover.present();
        }
    }

    async getActiveProfileUid() {
        let userId = '';
        try {
            const activeProfileSession: ProfileSession = await this.profile.getActiveProfileSession().toPromise();

            userId = activeProfileSession.uid;
            if (activeProfileSession.managedSession) {
                userId = activeProfileSession.managedSession.uid;
            }
        } catch (e) {
            console.error(e);
        }

        return userId;
    }

    async showYearOfBirthPopup(userProfile) {
        if (userProfile && !userProfile.managedBy && !userProfile.dob) {
            const newThemePopover = await this.popoverCtrl.create({
                component: YearOfBirthPopupComponent,
                componentProps: {   },
                backdropDismiss: false,
                showBackdrop: true,
                cssClass: 'year-of-birth-popup'
            });
            await newThemePopover.present();
        }
    }

    setAccessibilityFocus(id) {
        setTimeout(() => {
            const ele = document.getElementById(id);
            if (ele) {
                ele.focus();
            } 
        }, 100);
    }

    async generateTelemetryForSplashscreen() {
        const isFirstTime = await this.preferences.getString('KEY_IS_FIRST_TIME').toPromise().then((data) => {
            return data ? false : true;
        });
        console.log('isFirstTime', isFirstTime);
        if (isFirstTime ) {
            this.preferences.putString('KEY_IS_FIRST_TIME', 'false').toPromise().then();
        }
        const action: {type: string, payload: any}[] = [
            {
                type: 'TELEMETRY',
                payload: {
                    eid: 'IMPRESSION',
                    extraInfo: {
                        isFirstTime
                    }
                }
            }, {
                type: 'TELEMETRY',
                payload: {
                    eid: 'INTERACT',
                    extraInfo: {
                        isFirstTime
                    }
                }
            }
        ];
        return action;
    }

}
