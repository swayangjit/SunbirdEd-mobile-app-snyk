import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ApplicationHeaderKebabMenuComponent } from '../../../app/components/application-header/application-header-kebab-menu.component';
import { urlConstants } from '../../../app/manage-learn/core/constants/urlConstants';
import { AppGlobalService } from '../../../services/app-global-service.service';
import { Environment, InteractSubtype, PageId } from '../../../services/telemetry-constants';
import { AppHeaderService } from '../../../services/app-header.service';
import { TelemetryGeneratorService } from '../../../services/telemetry-generator.service';
import { CommonUtilService } from '../../../services/common-util.service';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { Platform, PopoverController, ToastController } from '@ionic/angular';
import { CourseCertificate } from '@project-sunbird/client-services/models';
import { tap } from 'rxjs/operators';
import { CertificateDownloadService } from "@project-sunbird/sb-svg2pdf";
import { CertificateService, InteractType } from '@project-sunbird/sunbird-sdk';
import { Location } from '@angular/common';
import { UnnatiDataService } from '../../../app/manage-learn/core/services/unnati-data.service';
declare var cordova;

@Component({
  selector: 'app-certificate-view',
  templateUrl: './certificate-view.page.html',
  styleUrls: ['./certificate-view.page.scss'],
  providers: [CertificateDownloadService]
})
export class CertificateViewPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('certificateContainer', {static: true}) certificateContainer: ElementRef;
  @ViewChild('scrollWrap', {static: true}) scrollWrap: ElementRef;

  private activeUserId: string;

  pageData: {
    courseId: string;
    certificate: CourseCertificate;
  };
  acceptType = 'image/svg+xml';
  private gestureState = {
    posX: 0,
    posY: 0,
    scale: 1,
    last_scale: 1,
    last_posX: 0,
    last_posY: 0,
    max_pos_x: 0,
    max_pos_y: 0,
    transform: ''
  };
  headerConfig: any;
  onPopupOpen = false;
  projectData:any;
  message:string;
  paramData;
  constructor(
    @Inject('CERTIFICATE_SERVICE') private certificateService: CertificateService,
    private certificateDownloadService: CertificateDownloadService,
    private appHeaderService: AppHeaderService,
    private commonUtilService: CommonUtilService,
    private appGlobalService: AppGlobalService,
    private router: Router,
    private fileOpener: FileOpener,
    private toastController: ToastController,
    private popoverCtrl: PopoverController,
    public platform: Platform,
    private telemetryGeneratorService: TelemetryGeneratorService,
    private location: Location,
    private apiService : UnnatiDataService
  ) {
    this.paramData = this.router.getCurrentNavigation().extras.state.request;
  }

  async ngOnInit() {
    await this.appGlobalService.getActiveProfileUid().then((activeUserId) => this.activeUserId = activeUserId).catch(err => console.log(err));
      if(this.paramData.type == 'project'){
        this.projectData = this.paramData;
        let keys = Object.keys(this.projectData.certificate);
        if( this.projectData.certificate &&  this.projectData.certificate.eligible && this.projectData.certificate.osid){
          await this.getProjectCertificate();
        }else{
          if((this.projectData.certificate && (keys[this.projectData.certificate.eligible]  && !this.projectData.certificate.eligible) ) || (this.projectData.certificate && this.projectData.certificate.eligible && !this.projectData.certificate.osid)){
            this.message = 'FRMELEMNTS_MSG_PROJECT_SUBMITTED_CERTIFICATE_SOON'
          }else
          if((this.projectData.certificate && !keys[this.projectData.certificate.eligible] )){
            this.message = 'FRMELEMNTS_MSG_NOT_MET_CERTIFCATE'
          }
        }
      }else{
        this.pageData = this.paramData;
        await this.loadCertificate();
      } 

    await this.appHeaderService.showHeaderWithBackButton();
  }

  ngAfterViewInit() {}
  async getProjectCertificate(){
    const config ={
      url : urlConstants.API_URLS.PROJECT_CERTIFICATE_DOWNLOAD + this.projectData.certificate.osid,
     headers:{
      template :this.projectData.templateUrl,
      accept:this.acceptType
     }
    }
    await this.apiService.get(config).pipe(
      tap(this.initCertificateTemplate.bind(this)),
    ).toPromise();
  }
  ngOnDestroy() {

  }

  public onGestureEvent(ev) {
    /* istanbul ignore next */
    (/* gesture based pan/zoom */() => {
      const el = this.scrollWrap.nativeElement;

      let {
        posX,
        posY,
        scale,
        last_scale,
        last_posX,
        last_posY,
        max_pos_x,
        max_pos_y,
        transform
      } = this.gestureState;

      // pan
      if (scale !== 1) {
        posX = last_posX + ev.deltaX;
        posY = last_posY + ev.deltaY;
        max_pos_x = Math.ceil((scale - 1) * el.clientWidth / 2);
        max_pos_y = Math.ceil((scale - 1) * el.clientHeight / 2);
        if (posX > max_pos_x) {
          posX = max_pos_x;
        }
        if (posX < -max_pos_x) {
          posX = -max_pos_x;
        }
        if (posY > max_pos_y) {
          posY = max_pos_y;
        }
        if (posY < -max_pos_y) {
          posY = -max_pos_y;
        }
      }


      // pinch
      if (ev.type === 'pinch') {
        scale = Math.max(.999, Math.min(last_scale * (ev.scale), 4));
      }
      if (ev.type === 'pinchend') {last_scale = scale; }

      // panend
      if (ev.type === 'panend') {
        last_posX = posX < max_pos_x ? posX : max_pos_x;
        last_posY = posY < max_pos_y ? posY : max_pos_y;
      }

      if (scale !== 1) {
        transform =
            'translate3d(' + posX + 'px,' + posY + 'px, 0) ' +
            'scale3d(' + scale + ', ' + scale + ', 1)';
      }

      if (transform) {
        el.style.webkitTransform = transform;
      }

      this.gestureState = {
        posX,
        posY,
        scale,
        last_scale,
        last_posX,
        last_posY,
        max_pos_x,
        max_pos_y,
        transform
      };
    })();
  }

  private async loadCertificate() {
    const loader = await this.commonUtilService.getLoader();
    loader.present();

    await this.certificateService.getCertificate(this.pageData).pipe(
      tap(this.initCertificateTemplate.bind(this)),
    ).toPromise();

    loader.dismiss();
  }

  private initCertificateTemplate(template: string) {
    if (template.startsWith('data:image/svg+xml,')) {
      template = decodeURIComponent(template.replace(/data:image\/svg\+xml,/, '')).replace(/\<!--\s*[a-zA-Z0-9\-]*\s*--\>/g, '');
    }
    
    if (this.platform.is('ios')) {
      template = template.replace("`${maxFontSize}px`", "'18px'");
      template = template.replace("`${minFontSize}px`", "'13px'");
      template = template.replace(/`/gi, "\"");
      var ref = cordova.InAppBrowser.open('', '_blank');
      ref.executeScript( { code : `
        var certs = document.createElement('div');
        certs.setAttribute('id', 'certid');
        document.body.appendChild(certs);`
      } );
  
      let funcExecute = () => {
        ref.executeScript({ code: `
          var certs = document.getElementById('certid');
          certs.innerHTML = \`${template}\`
        ` });
        ref.insertCSS({ code: "body{height: 100%;}" });
      };
      setTimeout(funcExecute, 1000);
      let that = this;
      ref.addEventListener('exit', function (event) {
        that.location.back();
      });
    } else {
      this.certificateContainer.nativeElement.innerHTML = template;
    }
  }

  private async listenActionEvents(option) {
      const toast = await this.toastController.create({
        message: this.commonUtilService.translateMessage('CERTIFICATE_DOWNLOAD_INFO')
      });
      await toast.present();

      try {
        const downloadRequest = await (async () => {
        const baseFileName =  this.pageData ?
          `${this.pageData.certificate.name}_${this.pageData.courseId}_${this.activeUserId}` : 'Project_certificate'+`${this.projectData.project}_${this.activeUserId}`
          switch (option.label) {
            case 'PDF': {
              this.generateDownloadTypeTelemetry('pdf');
              return {
                fileName: baseFileName + '.pdf',
                mimeType: 'application/pdf',
                blob: await this.certificateDownloadService.buildBlob(
                  this.certificateContainer.nativeElement.querySelector('svg'),
                  'pdf'
                )
              };
            }
            case 'PNG': {
              this.generateDownloadTypeTelemetry('png');
              return {
                fileName: baseFileName + '.png',
                mimeType: 'image/png',
                blob: await this.certificateDownloadService.buildBlob(
                  this.certificateContainer.nativeElement.querySelector('svg'),
                  'png'
                )
              };
            }
            default: {
              await toast.dismiss();
              throw new Error('INVALID_OPTION');
            }
          }
        })();

        const { path } = await this.certificateService.downloadCertificate(downloadRequest).toPromise();
        await this.fileOpener.open(path, downloadRequest.mimeType);
      } catch (e) {
        this.commonUtilService.showToast(this.commonUtilService.translateMessage('SOMETHING_WENT_WRONG'));
        console.error(e);
      } finally {
        await toast.dismiss();
      }

  }

  private generateDownloadTypeTelemetry(type: string) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      type, '',
      Environment.USER,
      PageId.CERTIFICATE_VIEW,
      undefined,
      undefined,
      undefined,
      undefined,
      InteractSubtype.DOWNLOAD_CLICKED
    );
  }

  async showCertificateMenu(event) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH, InteractSubtype.DOWNLOAD_CLICKED,
      Environment.USER,
      PageId.CERTIFICATE_VIEW
    );
    const certificatePopover = await this.popoverCtrl.create({
      component: ApplicationHeaderKebabMenuComponent,
      event,
      showBackdrop: false,
      componentProps: {
        options: [
          { label: 'PDF', value: {} },
          { label: 'PNG', value: {} },
        ] || []
      },
      cssClass: 'certificate-popup'
    });
    this.onPopupOpen = true;
    await certificatePopover.present();
    const { data } = await certificatePopover.onDidDismiss();
    this.onPopupOpen = false;
    if (!data) {
      return;
    }
    await this.listenActionEvents(data.option);
  }
}


