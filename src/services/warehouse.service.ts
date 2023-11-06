import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  TMWU_WAREHOUSE_SETTINGS_PROVIDER,
  WarehouseSettingsProvider,
} from "../modules/warehouse.module";
import { isFuture, addMinutes, isPast } from "date-fns";
import { randomString } from "../utils/string/random-string.util";
import { AccessToken } from "../types/token/access-token.type";
import { SignedToken } from "../types/token/signed-token.type";
import NodeRSA from "node-rsa";

type SignOptions = {
  fileId: string;
  expiresAt?: Date;
};

@Injectable()
export class WarehouseService {
  constructor(
    @Inject(TMWU_WAREHOUSE_SETTINGS_PROVIDER)
    private readonly warehouseSettings: WarehouseSettingsProvider
  ) {}

  private async generateSignedToken({
    fileId,
    expiresAt: definedExpiresAt,
  }: SignOptions) {
    if (definedExpiresAt && !isFuture(definedExpiresAt))
      throw new Error("expiresAt must be a future time");

    const expiresAt = definedExpiresAt ?? addMinutes(new Date(Date.now()), 30);

    const signedToken = JSON.stringify({
      w: this.warehouseSettings.setupInfo.warehouseName,
      st: this.encryptWithPublicKey(
        this.warehouseSettings.setupInfo.publicKey,
        JSON.stringify({
          expiresAt,
          fileId,
          salt: randomString(24),
        } as SignedToken)
      ),
    } as AccessToken);

    // Convert to Base64
    const encoder = new TextEncoder();
    const data = encoder.encode(signedToken);

    return Buffer.from(data).toString("base64");
  }

  public async generateFileAccess(options: SignOptions) {
    const signedToken = await this.generateSignedToken(options);

    return {
      url: `${this.warehouseSettings.options.host}/warehouse/file?token=${signedToken}`,
      token: signedToken,
      warehouseHost: this.warehouseSettings.options.host,
    };
  }

  public async decodeAccessToken(token: string, privateKey: string) {
    // Convert from Base64 to string
    const base64Data = Uint8Array.from(atob(token), (c) => c.charCodeAt(0));
    const decodedJSONToken = new TextDecoder().decode(base64Data);
    const { w, st }: AccessToken = JSON.parse(decodedJSONToken);

    const decodedToken = JSON.parse(
      this.decryptWithPrivateKey(privateKey, st)
    ) as Omit<SignedToken, "expiresAt"> & { expiresAt: string };

    if (isPast(new Date(decodedToken.expiresAt)))
      throw new ForbiddenException();
    return {
      warehouseName: w,
      ...decodedToken,
    };
  }

  // RSA methods
  private encryptWithPublicKey(publicKey: string, text: string) {
    const key = new NodeRSA(publicKey, "public");
    return key.encrypt(text, "base64") as string;
  }

  private decryptWithPrivateKey(privateKey: string, encryptedText: string) {
    const key = new NodeRSA(privateKey, "private");
    return key.decrypt(encryptedText, "utf8") as string;
  }
}
