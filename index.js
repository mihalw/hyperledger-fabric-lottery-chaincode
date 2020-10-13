/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const lottery = require('./lib/lottery');

module.exports.Lottery = lottery;
module.exports.contracts = [lottery];
