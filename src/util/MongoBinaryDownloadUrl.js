/* @flow */
/* eslint-disable class-methods-use-this */

import getos from 'getos';

type OS = {
  dist: string,
  release?: string,
};

const DOWNLOAD_URI = 'https://downloads.mongodb.org';

export type MongoBinaryDownloadUrlOpts = {
  version: string,
  platform: string,
  arch: string,
  ssl?: boolean,
  os?: ?OS, // getos() result
};

export default class MongoBinaryDownloadUrl {
  platform: string;
  arch: string;
  ssl: ?boolean;
  version: string;
  os: ?OS;

  constructor({ platform, arch, ssl, version, os }: MongoBinaryDownloadUrlOpts) {
    this.platform = this.translatePlatform(platform, os);
    this.arch = this.translateArch(arch, this.platform);
    this.ssl = ssl;
    this.version = version;
    this.os = os;
  }

  async getDownloadUrl(): Promise<string> {
    const archive = await this.getArchiveName();
    return `${DOWNLOAD_URI}/${this.platform}/${archive}`;
  }

  async getArchiveName(): Promise<string> {
    let name = `mongodb-${this.platform}`;

    if (this.ssl) {
      name += '-ssl';
    }

    if (this.platform !== 'src') {
      name += `-${this.arch}`;
    }

    let osString;
    if (this.platform === 'linux' && this.arch !== 'i686') {
      if (!this.os) this.os = await this.getos();
      osString = this.getLinuxOSVersionString(this.os);
    }

    if (osString) {
      name += `-${osString}`;
    }
    if (this.platform !== 'src') {
      name += `-${this.version}.${this.getArchiveType()}`;
    } else {
      name += `-r${this.version}.${this.getArchiveType()}`;
    }

    return name;
  }

  getArchiveType(): string {
    switch (this.platform) {
      case 'win32':
        return 'zip';
      case 'src':
        return 'tar.gz';
      default:
        return 'tgz';
    }
  }

  async getos(): Promise<OS> {
    return new Promise((resolve, reject) => {
      getos((e: any, os: any) => {
        if (e) reject(e);
        resolve(os);
      });
    });
  }

  getLinuxOSVersionString(os: OS): string {
    if (/ubuntu/i.test(os.dist)) {
      return this.getUbuntuVersionString(os);
    } else if (/elementary OS/i.test(os.dist)) {
      return this.getElementaryOSVersionString(os);
    } else if (/suse/i.test(os.dist)) {
      return this.getSuseVersionString(os);
    } else if (/rhel/i.test(os.dist) || /centos/i.test(os.dist) || /scientific/i.test(os.dist)) {
      return this.getRhelVersionString(os);
    } else if (/fedora/i.test(os.dist)) {
      return this.getFedoraVersionString(os);
    } else if (/debian/i.test(os.dist)) {
      return this.getDebianVersionString(os);
    } else if (/mint/i.test(os.dist)) {
      return this.getMintVersionString(os);
    }
    console.warn(`Unknown linux distro ${os.dist}, falling back to legacy MongoDB build`);
    return this.getLegacyVersionString(os);
  }

  getDebianVersionString(os: OS): string {
    let name: string = 'debian';
    const release: number = parseFloat(os.release);
    if (release >= 8.1) {
      name += '81';
    } else if (release >= 7.1) {
      name += '71';
    }
    return name;
  }

  getFedoraVersionString(os: OS): string {
    let name: string = 'rhel';
    const fedoraVer: number = parseInt(os.release, 10);
    if (fedoraVer > 18) {
      name += '70';
    } else if (fedoraVer < 19 && fedoraVer >= 12) {
      name += '62';
    } else if (fedoraVer < 12 && fedoraVer >= 6) {
      name += '55';
    }
    return name;
  }

  getRhelVersionString(os: OS): string {
    let name: string = 'rhel';
    const { release } = os;
    if (release) {
      if (/^7/.test(release)) {
        name += '70';
      } else if (/^6/.test(release)) {
        name += '62';
      } else if (/^5/.test(release)) {
        name += '55';
      }
    }
    return name;
  }

  // eslint-disable-next-line no-unused-vars
  getElementaryOSVersionString(os: OS): string {
    return 'ubuntu1404';
  }

  // eslint-disable-next-line no-unused-vars
  getMintVersionString(os: OS): string {
    // unfortunately getos doesn't return version for Mint
    return 'ubuntu1404';
  }

  // eslint-disable-next-line no-unused-vars
  getLegacyVersionString(os: OS): string {
    return '';
  }

  getSuseVersionString(os: any): string {
    const [release]: [string | null] = os.release.match(/(^11|^12)/) || [null];

    if (release) {
      return `suse${release}`;
    }
    return '';
  }

  getUbuntuVersionString(os: OS): string {
    let name: string = 'ubuntu';
    const ubuntuVer: string[] = os.release ? os.release.split('.') : [];
    const majorVer: number = parseInt(ubuntuVer[0], 10);
    // const minorVer: string = ubuntuVer[1];

    if (os.release === '12.04') {
      name += '1204';
    } else if (os.release === '14.04') {
      name += '1404';
    } else if (os.release === '14.10') {
      name += '1410-clang';
    } else if (majorVer === 14) {
      name += '1404';
    } else if (os.release === '16.04') {
      name += '1604';
    } else if (majorVer === 16) {
      name += '1604';
    } else {
      name += '1404';
    }
    return name;
  }

  translatePlatform(platform: string, os: OS): string {
    if (os && os.dist === 'Raspbian') {
      return 'src';
    }
    switch (platform) {
      case 'darwin':
        return 'osx';
      case 'win32':
        return 'win32';
      case 'linux':
        return 'linux';
      case 'elementary OS':
        return 'linux';
      case 'sunos':
        return 'sunos5';
      default:
        throw new Error(`unsupported OS ${platform}`);
    }
  }

  translateArch(arch: string, mongoPlatform: string): string {
    if (arch === 'ia32') {
      if (mongoPlatform === 'linux') {
        return 'i686';
      } else if (mongoPlatform === 'win32') {
        return 'i386';
      }
      throw new Error('unsupported architecture');
    } else if (arch === 'x64') {
      return 'x86_64';
    } else {
      throw new Error('unsupported architecture, ia32 and x64 are the only valid options');
    }
  }
}
