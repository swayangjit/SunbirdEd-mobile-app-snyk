import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import {RouterLinks} from '../../../app/app.constant';
import { AppVersion } from '@awesome-cordova-plugins/app-version/ngx';
import {Environment, InteractSubtype, InteractType } from '../../../services/telemetry-constants';
import { TelemetryGeneratorService } from '../../../services/telemetry-generator.service';

@Component({
  selector: 'app-sign-in-card',
  templateUrl: './sign-in-card.component.html',
  styleUrls: ['./sign-in-card.component.scss'],
})
export class SignInCardComponent {

  @Input() source = '';
  @Input() title = 'OVERLAY_LABEL_COMMON';
  @Input() description = 'OVERLAY_INFO_TEXT_COMMON';
  @Output() valueChange = new EventEmitter();
  appName = '';

  constructor(
    private appVersion: AppVersion,
    private router: Router,
    private telemetryGeneratorService: TelemetryGeneratorService
  ) {

    this.appVersion.getAppName()
      .then((appName: any) => {
        this.appName = appName;
      }).catch((err) => {});
  }

  async signIn(skipNavigation?) {
    if (this.source) {
      skipNavigation['source'] = this.source;
    }
    this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.TOUCH,
        InteractSubtype.SIGNIN_OVERLAY_CLICKED,
        Environment.HOME,
        this.source, null
    );

    await this.router.navigate([RouterLinks.SIGN_IN], {state: skipNavigation});
  }
}
