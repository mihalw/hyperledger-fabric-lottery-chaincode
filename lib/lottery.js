/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
var seedrandom = require('seedrandom');

class Lottery extends Contract {

    async InitLedger(ctx) {
        // inicjalizacja liczników stworzonych użytkowników i loterii służących w celu tworzenia unikalnych identyfikatorów
        let userCounter = 0;
        let lotteryCounter = 0;

        // inicjalizacja 4 początkowych użytkowników
        const users = [
            {
                id: "USER" + userCounter++,
                name: "Adrian",
                balance: 100,
            },
            {
                id: "USER" + userCounter++,
                name: "Krzysztof",
                balance: 100,
            },
            {
                id: "USER" + userCounter++,
                name: "Marek",
                balance: 100,
            },
            {
                id: "USER" + userCounter++,
                name: "Piotr",
                balance: 100,
            },
        ];

        // dodanie stworzonych użytkowników do "stanu świata" rejestru
        for (const user of users) {
            await ctx.stub.putState(user.id, Buffer.from(JSON.stringify(user)));
            console.info(`User ${user.name} with id=${user.id} added to system`);
        }

        // stworzenie i zapisanie stanu generatora liczb losowych
        var randomGenerator = seedrandom("secret-seed", { state: true });
        ctx.stub.putState("randomGenerator", Buffer.from(JSON.stringify(randomGenerator.state())));

        // zapisanie  w "stanie świata" stanu licznika stworzonych użytkowników i loterii
        ctx.stub.putState("userCounter", Buffer.from(JSON.stringify(userCounter)));
        return ctx.stub.putState("lotteryCounter", Buffer.from(JSON.stringify(lotteryCounter)));
    }


    async CreateLottery(ctx, name, requiredParticipants) {
        if (requiredParticipants <= 1) {
            throw new Error(`Lottery requires more than 1 participant!`);
        }

        let lotteryCounter = await ctx.stub.getState("lotteryCounter");
        const lottery = {
            id: "LOTTERY" + lotteryCounter++,
            name: name,
            balance: 0,
            numberOfParticipants: 0,
            participants: [],
            balanceAfterEachPayment: [],
            requiredParticipants: JSON.parse(requiredParticipants),
            winner: "unknown yet"
        };

        ctx.stub.putState(lottery.id, Buffer.from(JSON.stringify(lottery)));
        return ctx.stub.putState("lotteryCounter", Buffer.from(JSON.stringify(lotteryCounter)));
    }


    async CreateUser(ctx, name, balance) {
        if (balance < 0) {
            throw new Error(`The balance cannot be negative!`);
        }

        let userCounter = await ctx.stub.getState("userCounter");
        const user = {
            id: 'USER' + userCounter++,
            name: name,
            balance: JSON.parse(balance),
        };

        ctx.stub.putState(user.id, Buffer.from(JSON.stringify(user)));
        return ctx.stub.putState("userCounter", Buffer.from(JSON.stringify(userCounter)));
    }


    async BuyLotteryTicket(ctx, lotteryId, userId, amount) {
        var changedAssets = await this.HandleTicketPurchase(ctx, userId, lotteryId, amount);
        var lottery = changedAssets.lottery;
        var user = changedAssets.user;

        if (lottery.numberOfParticipants == lottery.requiredParticipants) {
            var winner = await this.DrawWinner(ctx, lottery, user);
            winner.balance += lottery.balance;
            lottery.balance = 0;
            lottery.winner = winner.id;

            // jeśli zwycięzcą jest inna osoba niż ostatni wpłacający 
            // to aktualizowany jest obiekt ostatnio wpłacającego i zwycięzcy
            if (user != winner)
                ctx.stub.putState(user.id, Buffer.from(JSON.stringify(user)));
            ctx.stub.putState(winner.id, Buffer.from(JSON.stringify(winner)));
            return ctx.stub.putState(lottery.id, Buffer.from(JSON.stringify(lottery)));
        }

        ctx.stub.putState(user.id, Buffer.from(JSON.stringify(user)));
        return ctx.stub.putState(lottery.id, Buffer.from(JSON.stringify(lottery)));
    }

    async HandleTicketPurchase(ctx, userId, lotteryId, amount) {
        let userString = await this.UserDetails(ctx, userId);
        let user = JSON.parse(userString);
        let lotteryString = await this.LotteryDetails(ctx, lotteryId);
        let lottery = JSON.parse(lotteryString);
        VerifyParticipationRequirements(lottery, user, amount);

        lottery.balance += JSON.parse(amount);
        user.balance -= JSON.parse(amount);

        lottery.participants.push(user.id);
        // balanceAfterEachPayment służy temu, aby podczas losowania szanse były proporcjonalne do wpłaconej kwoty
        lottery.balanceAfterEachPayment.push(lottery.balance);
        lottery.numberOfParticipants += 1;

        return { lottery: lottery, user: user };
    }

    async DrawWinner(ctx, lottery, user) {
        var randomGenerator = await this.GetGeneratorState(ctx);
        var randomNumber = randomGenerator() * lottery.balance;
        ctx.stub.putState("randomGenerator", Buffer.from(JSON.stringify(randomGenerator.state())));

        var i;
        for (i = 0; i < lottery.numberOfParticipants - 1; i++) {
            if (lottery.balanceAfterEachPayment[i] >= randomNumber) {
                let winnerString = await this.UserDetails(ctx, (lottery.participants)[i]);
                let winnerUser = JSON.parse(winnerString);
                return winnerUser;
            }
        }
        return user;
    }

    async GetGeneratorState(ctx) {
        var savedGeneratorJSON = await ctx.stub.getState("randomGenerator");
        var savedGeneratorState = JSON.parse(savedGeneratorJSON);
        var randomGenerator = seedrandom("", { state: savedGeneratorState });
        return randomGenerator;
    }

    async UserDetails(ctx, id) {
        const userExists = await this.AssetExists(ctx, id);
        if (!userExists) {
            throw new Error(`The user with id=${id} does not exist`);
        }

        const userJSON = await ctx.stub.getState(id);
        return userJSON.toString();
    }

    async LotteryDetails(ctx, id) {
        const lotteryExists = await this.AssetExists(ctx, id);
        if (!lotteryExists) {
            throw new Error(`The lottery with id=${id} does not exist`);
        }

        const lotteryJSON = await ctx.stub.getState(id);
        return lotteryJSON.toString();
    }

    async AssetExists(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }

    async ShowAssets(ctx, asset) {
        const results = [];
        var iterator;
        if (asset == "user")
            iterator = await ctx.stub.getStateByRange('USER0', 'USER9999');
        else if (asset == "lottery")
            iterator = await ctx.stub.getStateByRange('LOTTERY0', 'LOTTERY999');
        else if (asset == "all")
            iterator = await ctx.stub.getStateByRange('', '');
        var result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            results.push({ Key: result.value.key, Record: record });
            result = await iterator.next();
        }
        return JSON.stringify(results);
    }

    async DeleteUser(ctx, id) {
        await this.AssetExists(ctx, id);
        return ctx.stub.deleteState(id);
    }

    async DeleteLottery(ctx, id) {
        const lotteryExists = await this.AssetExists(ctx, id);
        if (!lotteryExists) {
            throw new Error(`The lottery with id=${id} does not exist`);
        }
        const lotteryString = await this.LotteryDetails(ctx, id);
        const lottery = JSON.parse(lotteryString);
        if (lottery.balance != 0) {
            throw new Error(`Cannot delete lottery with id=${id} because its balance is not 0!`);
        }
        return ctx.stub.deleteState(id);
    }
}

module.exports = Lottery;

function VerifyParticipationRequirements(lottery, user, amount) {
    if (lottery.numberOfParticipants == lottery.requiredParticipants) {
        throw new Error(`The lottery is settled and you can no longer join it!`);
    }
    if (lottery.participants.includes(user.id)) {
        throw new Error(`The user with id=${user.id} is already participating in this lottery!`);
    }
    if (amount <= 0) {
        throw new Error(`The user with id=${user.id} must deposit more than 0!`);
    }
    if (user.balance < amount) {
        throw new Error(`The user with id=${user.id} wanted to deposit more money than he owns!`);
    }
}