import {Command, flags} from '@oclif/command'
import ux from 'cli-ux'
import * as request from 'request-promise-native'

import {AcquiaHttpHmac} from './api-hmac'

class AcCd extends Command {
  static description = 'describe the command here'

  static flags = {
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    appId: flags.string({char: 'a', description: 'application\'s id. Used for creating CD environments'}),
    branch: flags.string({char: 'b', description: 'Git branch to create the CDE with.'}),
    label: flags.string({char: 'l', description: 'Label to create or delete the CDE with.'}),
    databases: flags.string({char: 'd', description: 'comma separated database names to use for the CDE. IE main,master,some_db'}),
  }

  static args = [{
    name: 'action',
    description: 'Either "create" or "delete" a CDE'
  }]

  async run() {
    const {args, flags} = this.parse(AcCd)

    let response
    let headers

    let hmac = new AcquiaHttpHmac({
      realm: 'Acquia',
      public_key: process.env.AC_CLOUD_API_KEY || 'foo',
      secret_key: process.env.AC_CLOUD_API_SECRET || 'bar',
      version: '2.0',
      default_content_type: 'application/json'
    })

    switch (args.action) {
    /**
     * CREATE A CDE
     */
    case 'create':
      this.requireFlag(flags, 'appId')
      this.requireFlag(flags, 'label')
      this.requireFlag(flags, 'branch')

      const createURL = `https://cloud.acquia.com/api/applications/${flags.appId}/environments`

      const bodyString = JSON.stringify({
        label: flags.label,
        branch: flags.branch,
        databases: flags.databases ? flags.databases.split(',') : undefined
      })

      headers = hmac.signHeaders({
        httpMethod: 'POST',
        fullURL: createURL,
        bodyString,
        headers: {},
        content_type: 'application/json'
      })

      response = await request.post({
        uri: createURL,
        json: JSON.parse(bodyString),
        headers
      })
      break

    /**
     * DELETE A CDE
     */
    case 'delete':
      this.requireFlag(flags, 'label')
      this.requireFlag(flags, 'appId')

      let listURL = `https://cloud.acquia.com/api/applications/${flags.appId}/environments?filter=label%3D${flags.label}`

      let listResponse = await request.get({
        uri: listURL,
        headers: hmac.signHeaders({
          httpMethod: 'GET',
          fullURL: listURL,
          bodyString: '',
          headers: {},
          content_type: 'application/json'
        })
      })

      listResponse = JSON.parse(listResponse)

      const apps = listResponse._embedded.items

      if (apps.length === 0) {
        this.error('Unable to find an environment with that label or application id')
      }

      const envId = apps[0].id

      let deleteURL = `https://cloud.acquia.com/api/environments/${envId}`
      response = await request.delete({
        uri: deleteURL,
        headers: hmac.signHeaders({
          httpMethod: 'DELETE',
          fullURL: deleteURL,
          bodyString: '',
          headers: {},
          content_type: 'application/json'
        }),
      })

      response = JSON.parse(response)
      break
    default:
      this.error('Unknown action! Must be "create" or "delete"')
    }

    ux.styledJSON(response)
  }

  private requireFlag(flags: any, name: string) {
    if (!flags[name]) {
      this.error(`The flag ${name} is required for that action.`)
    }
  }
}

export = AcCd
