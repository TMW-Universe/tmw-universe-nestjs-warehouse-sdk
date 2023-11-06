import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import axios from 'axios';
import { WarehouseService } from '../services/warehouse.service';

export const TMWU_WAREHOUSE_SETTINGS_PROVIDER =
  'tmwu_warehouse_settings_provider';

type SetupInfo = {
  publicKey: string;
  warehouseName: string;
};

type RegisterOptions = {
  apiKey: string;
  host: string;
  configRetryDelay?: number;
};

export interface WarehouseSettingsProvider {
  options: RegisterOptions;
  setupInfo: SetupInfo;
}

@Global()
@Module({})
export class WarehouseModule {
  static async register(options: RegisterOptions): Promise<DynamicModule> {
    // Look for the Public Key
    let setupInfo: SetupInfo = null;
    do {
      try {
        const { data } = await axios.get<SetupInfo>(
          options.host + '/setup/info',
          {
            headers: {
              'api-key': options.apiKey,
            },
          },
        );

        setupInfo = data;

        // If there is a public key, exit the loop
        if (setupInfo) break;
      } catch (e) {
        Logger.warn('Cannot obtain setup information', 'Warehouse SDK');
      }

      // Wait X seconds until a retry is made
      await new Promise((r) =>
        setTimeout(r, options.configRetryDelay ?? 10000),
      );
    } while (!setupInfo);

    Logger.log('Obtained Warehouse setup information', 'Warehouse SDK');

    return {
      module: WarehouseModule,
      providers: [
        {
          provide: TMWU_WAREHOUSE_SETTINGS_PROVIDER,
          useValue: {
            options,
            setupInfo,
          } satisfies WarehouseSettingsProvider,
        },
        WarehouseService,
      ],
      exports: [WarehouseService],
    };
  }

  static async registerAsync(fn: () => Promise<RegisterOptions>) {
    return WarehouseModule.register(await fn());
  }
}
