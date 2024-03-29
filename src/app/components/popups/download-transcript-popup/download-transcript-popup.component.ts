import { Component, Inject, Input, OnInit } from '@angular/core';
import { AndroidPermission, AndroidPermissionsStatus } from '../../../../services/android-permissions/android-permission';
import { CommonUtilService } from '../../../../services/common-util.service';
import { Environment, InteractSubtype, PageId } from '../../../../services/telemetry-constants';
import { PopoverController,Platform, } from '@ionic/angular';
import { ContentService, InteractType } from '@project-sunbird/sunbird-sdk';
import { TelemetryGeneratorService } from '../../../../services/telemetry-generator.service';
import { AppGlobalService } from '../../../../services/app-global-service.service';
import { AndroidPermissionsService } from '../../../../services/android-permissions/android-permissions.service';

@Component({
  selector: 'app-download-transcript-popup',
  templateUrl: './download-transcript-popup.component.html',
  styleUrls: ['./download-transcript-popup.component.scss'],
})
export class DownloadTranscriptPopupComponent implements OnInit {

  transcriptLanguage: string;
  appName = '';
  @Input() contentData;
  constructor(
    @Inject('CONTENT_SERVICE') private contentService: ContentService,
    private popOverCtrl: PopoverController,
    private commonUtilService: CommonUtilService,
    private platform: Platform,
    private telemetryGeneratorService: TelemetryGeneratorService,
    private appGlobalService: AppGlobalService,
    private permissionService: AndroidPermissionsService,
  ) { }
  ngOnInit(): void {
    console.log('download-transcript-popup.component');   
  }
  private async checkForPermissions(): Promise<boolean | undefined> {
    if(this.platform.is('ios')) {
      return new Promise<boolean | undefined>((resolve, reject) => {
        resolve(true);
      });
    }
    return new Promise<boolean | undefined>(async (resolve) => {
      const permissionStatus = await this.commonUtilService.getGivenPermissionStatus(AndroidPermission.WRITE_EXTERNAL_STORAGE);
      if (permissionStatus.hasPermission) {
        resolve(true);
      } else if (permissionStatus.isPermissionAlwaysDenied) {
        await this.commonUtilService.showSettingsPageToast('FILE_MANAGER_PERMISSION_DESCRIPTION', this.appName, PageId.PROFILE, true);
        resolve(false);
      } else {
        await this.showStoragePermissionPopup().then((result) => {
          if (result) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    });
  }

  private async showStoragePermissionPopup(): Promise<boolean | undefined> {
    return new Promise<boolean | undefined>(async (resolve) => {
      const confirm = await this.commonUtilService.buildPermissionPopover(
        async (selectedButton: string) => {
          if (selectedButton === this.commonUtilService.translateMessage('NOT_NOW')) {
            this.telemetryGeneratorService.generateInteractTelemetry(
              InteractType.TOUCH,
              InteractSubtype.NOT_NOW_CLICKED,
              Environment.SETTINGS,
              PageId.PERMISSION_POPUP);
            await this.commonUtilService.showSettingsPageToast('FILE_MANAGER_PERMISSION_DESCRIPTION', this.appName, PageId.PROFILE, true);
          } else if (selectedButton === this.commonUtilService.translateMessage('ALLOW')) {
            this.telemetryGeneratorService.generateInteractTelemetry(
              InteractType.TOUCH,
              InteractSubtype.ALLOW_CLICKED,
              Environment.SETTINGS,
              PageId.PERMISSION_POPUP);
            this.appGlobalService.isNativePopupVisible = true;
            this.permissionService.requestPermission(AndroidPermission.WRITE_EXTERNAL_STORAGE)
              .subscribe(async (status: AndroidPermissionsStatus) => {
                if (status.hasPermission) {
                  this.telemetryGeneratorService.generateInteractTelemetry(
                    InteractType.TOUCH,
                    InteractSubtype.ALLOW_CLICKED,
                    Environment.SETTINGS,
                    PageId.APP_PERMISSION_POPUP
                  );
                  resolve(true);
                } else if (status.isPermissionAlwaysDenied) {
                  await this.commonUtilService.showSettingsPageToast
                    ('FILE_MANAGER_PERMISSION_DESCRIPTION', this.appName, PageId.PROFILE, true);
                  resolve(false);
                } else {
                  this.telemetryGeneratorService.generateInteractTelemetry(
                    InteractType.TOUCH,
                    InteractSubtype.DENY_CLICKED,
                    Environment.SETTINGS,
                    PageId.APP_PERMISSION_POPUP
                  );
                  await this.commonUtilService.showSettingsPageToast
                    ('FILE_MANAGER_PERMISSION_DESCRIPTION', this.appName, PageId.PROFILE, true);
                }
                this.appGlobalService.setNativePopupVisible(false);
                resolve(undefined);
              });
          }
        }, this.appName, this.commonUtilService.translateMessage
        ('FILE_MANAGER'), 'FILE_MANAGER_PERMISSION_DESCRIPTION', PageId.PROFILE, true
      );
      await confirm.present();
    });
  }
  
  async download() {
    const loader = await this.commonUtilService.getLoader();
    await this.popOverCtrl.dismiss();
    await loader.present();
    if(this.commonUtilService.isAndroidVer13()) {
      await this.downloadTranscriptData(loader);
    } else {
      await this.checkForPermissions().then(async (result) => {
        if (result) {
          this.downloadTranscriptData(loader)
        } else {
          await this.commonUtilService.showSettingsPageToast('FILE_MANAGER_PERMISSION_DESCRIPTION', this.appName, PageId.PROFILE, true);
        }
      });
    }
  }

  downloadTranscriptData(loader) {
    const transcriptsObj = this.contentData.transcripts;
    if (transcriptsObj) {
      let transcripts = [];
      if (typeof transcriptsObj === 'string') {
        console.log('....................')
        transcripts = JSON.parse(transcriptsObj);
      } else {
        transcripts = transcriptsObj;
      }
      if (transcripts && transcripts.length > 0) {
        transcripts.forEach(item => {
            if (item.language === this.transcriptLanguage) {
              const url = item.artifactUrl;
              const request = {
                identifier: item.identifier,
                downloadUrl: url,
                mimeType: '',
                fileName: this.contentData.name
              };
              this.contentService.downloadTranscriptFile(request).then((data) => {
                loader.dismiss();
              }).catch((err) => {
                console.log('err........', err);
                loader.dismiss();
              });
            }
        });
      } else {
        loader.dismiss();
      }
    }
  }

  closePopover() {
    this.popOverCtrl.dismiss();
  }

}
