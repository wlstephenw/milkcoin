const { expectRevert, time } = require('@openzeppelin/test-helpers');
const MilkToken = artifacts.require('MilkToken');
const MasterChef = artifacts.require('MilkChef');
const MockERC20 = artifacts.require('MockERC20');

const { BN } = require('web3-utils')

contract('MasterChef', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.milk = await MilkToken.new({ from: alice });
    });

    it('should set correct state variables', async () => {
        this.chef = await MasterChef.new(this.milk.address, '1000', '0', '1000', { from: alice });
        await this.milk.transferOwnership(this.chef.address, { from: alice });
        const milk = await this.chef.milk();
        const owner = await this.milk.owner();
        assert.equal(milk.valueOf(), this.milk.address);
        assert.equal(owner.valueOf(), this.chef.address);
    });


    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });
            this.lp3 = await MockERC20.new('LPToken3', 'LP3', '10000000000', { from: minter });
            await this.lp3.transfer(alice, '1000', { from: minter });
            await this.lp3.transfer(bob, '1000', { from: minter });
            await this.lp3.transfer(carol, '1000', { from: minter });
        });

        it('should set correct state variables', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await MasterChef.new(this.milk.address, '100', '100', '1000', { from: alice });
            await this.milk.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', [this.lp.address, this.lp2.address], true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            assert.equal(((await this.chef.poolInfo(0)).accMilkPerShare.div(new BN(1e12))).toString(), '0');
            assert.equal((await this.chef.poolLength()).toString(), '1');
            assert.equal((await this.chef.lpTokenLength(0)).toString(), '2');

        });

        it('event should be emmitted correctly', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await MasterChef.new(this.milk.address, '100', '100', '1000', { from: alice });
            await this.milk.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', [this.lp.address, this.lp2.address], true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            let deposit = await this.chef.deposit(0, 0, '100', { from: bob }); // 101
            let withdraw = await this.chef.withdraw(0, 0, '5', { from: bob });
            let emergencyWithdraw = await this.chef.emergencyWithdraw(0, { from: bob });
            assert.equal(deposit.logs[0].args.amount, '100');
            assert.equal(withdraw.logs[0].args.amount, '5');
            assert.equal(emergencyWithdraw.logs[0].args.amount, '95');
        });

        it('accMilkPerShare should set correctly', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await MasterChef.new(this.milk.address, '100', '100', '1000', { from: alice });
            await this.milk.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', [this.lp.address, this.lp2.address], true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await time.advanceBlockTo('100');
            assert.equal(((await this.chef.poolInfo(0)).accMilkPerShare.div(new BN(1e12))).toString(), '0');
            await this.chef.deposit(0, 0, '100', { from: bob }); // 101
            await this.chef.deposit(0, 0, '0', { from: bob }); // 102
            assert.equal(((await this.chef.poolInfo(0)).accMilkPerShare.div(new BN(1e12))).toString(), '10');
            await this.chef.deposit(0, 0, '100', { from: bob }); //103
            assert.equal(((await this.chef.poolInfo(0)).accMilkPerShare.div(new BN(1e12))).toString(), '20');
            await this.chef.deposit(0, 0, '0', { from: bob });  // 104
            assert.equal(((await this.chef.poolInfo(0)).accMilkPerShare.div(new BN(1e12))).toString(), '25');
        });

        it('should add new lp correctly', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await MasterChef.new(this.milk.address, '100', '100', '1000', { from: alice });
            await this.milk.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', [this.lp.address, this.lp2.address], true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.lp3.approve(this.chef.address, '1000', { from: bob });
            await this.chef.addNewLP(0, this.lp3.address);
            await time.advanceBlockTo('200');

            await this.chef.deposit(0, 0, '100', { from: bob }); // 101
            await this.chef.deposit(0, 2, '100', { from: bob }); // 102
            await this.chef.deposit(0, 0, '0', { from: bob }); // 103
            assert.equal(((await this.chef.poolInfo(0)).accMilkPerShare.div(new BN(1e12))).toString(), '15');
        });

        it('should distribute milks properly for each staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
            this.chef = await MasterChef.new(this.milk.address, '100', '300', '1000', { from: alice });
            await this.milk.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', [this.lp.address, this.lp2.address], true);
            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await this.lp2.approve(this.chef.address, '1000', { from: bob });
            await this.lp3.approve(this.chef.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo('309');
            await this.chef.deposit(0, 0, '10', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo('313');
            await this.chef.deposit(0, 1, '20', { from: bob });
            await this.chef.addNewLP(0, this.lp3.address);
            // Carol deposits 30 LPs at block 318
            await time.advanceBlockTo('317');
            await this.chef.deposit(0, 2, '30', { from: carol });
            // Alice deposits 10 more LPs at block 320. At this point:
            //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
            //   MasterChef should have the remaining: 10000 - 5666 = 4334
            await time.advanceBlockTo('319')
            await this.chef.deposit(0, 0, '10', { from: alice });
            assert.equal((await this.milk.totalSupply()).valueOf(), '10000');
            assert.equal((await this.milk.balanceOf(alice)).valueOf(), '5666');
            assert.equal((await this.milk.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.milk.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.milk.balanceOf(this.chef.address)).valueOf(), '4334');
            // Bob withdraws 5 LPs at block 330. At this point:
            //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
            await time.advanceBlockTo('329')
            await this.chef.withdraw(0, 1, '5', { from: bob });
            assert.equal((await this.milk.totalSupply()).valueOf(), '20000');
            assert.equal((await this.milk.balanceOf(alice)).valueOf(), '5666');
            assert.equal((await this.milk.balanceOf(bob)).valueOf(), '6190');
            assert.equal((await this.milk.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.milk.balanceOf(this.chef.address)).valueOf(), '8144');
            // Alice withdraws 20 LPs at block 340.
            // Bob withdraws 15 LPs at block 350.
            // Carol withdraws 30 LPs at block 360.
            await time.advanceBlockTo('339')
            await this.chef.withdraw(0, 0, '20', { from: alice });
            await time.advanceBlockTo('349')
            await this.chef.withdraw(0, 1, '15', { from: bob });
            await time.advanceBlockTo('359')
            await this.chef.withdraw(0, 2, '30', { from: carol });
            assert.equal((await this.milk.totalSupply()).valueOf(), '50000');
            // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
            assert.equal((await this.milk.balanceOf(alice)).valueOf(), '11600');
            // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
            assert.equal((await this.milk.balanceOf(bob)).valueOf(), '11831');
            // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
            assert.equal((await this.milk.balanceOf(carol)).valueOf(), '26568');
            // All of them should have 1000 LPs back.
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(carol)).valueOf(), '1000');
        });


    });
});
