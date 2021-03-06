import React from 'react';
import PropTypes from 'prop-types';
import {
	View, StyleSheet, SafeAreaView, FlatList, LayoutAnimation, Platform
} from 'react-native';
import { connect, Provider } from 'react-redux';
import { Navigation } from 'react-native-navigation';

import {
	addUser as addUserAction, removeUser as removeUserAction, reset as resetAction, setLoading as setLoadingAction
} from '../actions/selectedUsers';
import database from '../lib/realm';
import RocketChat from '../lib/rocketchat';
import UserItem from '../presentation/UserItem';
import Loading from '../containers/Loading';
import debounce from '../utils/debounce';
import LoggedView from './View';
import I18n from '../i18n';
import log from '../utils/log';
import SearchBox from '../containers/SearchBox';
import sharedStyles from './Styles';
import store from '../lib/createStore';

const styles = StyleSheet.create({
	safeAreaView: {
		flex: 1,
		backgroundColor: Platform.OS === 'ios' ? '#F7F8FA' : '#E1E5E8'
	},
	header: {
		backgroundColor: '#fff'
	},
	separator: {
		marginLeft: 60
	}
});

let CreateChannelView = null;

@connect(state => ({
	baseUrl: state.settings.Site_Url || state.server ? state.server.server : '',
	users: state.selectedUsers.users,
	loading: state.selectedUsers.loading
}), dispatch => ({
	addUser: user => dispatch(addUserAction(user)),
	removeUser: user => dispatch(removeUserAction(user)),
	reset: () => dispatch(resetAction()),
	setLoadingInvite: loading => dispatch(setLoadingAction(loading))
}))
/** @extends React.Component */
export default class SelectedUsersView extends LoggedView {
	static propTypes = {
		navigator: PropTypes.object,
		rid: PropTypes.string,
		nextAction: PropTypes.string.isRequired,
		baseUrl: PropTypes.string,
		addUser: PropTypes.func.isRequired,
		removeUser: PropTypes.func.isRequired,
		reset: PropTypes.func.isRequired,
		users: PropTypes.array,
		loading: PropTypes.bool,
		setLoadingInvite: PropTypes.func
	};

	constructor(props) {
		super('SelectedUsersView', props);
		this.data = database.objects('subscriptions').filtered('t = $0', 'd').sorted('roomUpdatedAt', true);
		this.state = {
			search: []
		};
		this.data.addListener(this.updateState);
		props.navigator.setOnNavigatorEvent(this.onNavigatorEvent.bind(this));
	}

	componentDidMount() {
		const { navigator } = this.props;
		navigator.setDrawerEnabled({
			side: 'left',
			enabled: false
		});
	}

	async componentDidUpdate(prevProps) {
		const { navigator, users } = this.props;
		const isVisible = await navigator.screenIsCurrentlyVisible();

		if (!isVisible) {
			return;
		}
		if (prevProps.users.length !== users.length) {
			const { length } = users;
			const rightButtons = [];
			if (length > 0) {
				rightButtons.push({
					id: 'create',
					title: I18n.t('Next'),
					testID: 'selected-users-view-submit'
				});
			}
			navigator.setButtons({ rightButtons });
		}
	}

	componentWillUnmount() {
		const { reset } = this.props;
		this.updateState.stop();
		this.data.removeAllListeners();
		reset();
	}

	async onNavigatorEvent(event) {
		if (event.type === 'NavBarButtonPress') {
			if (event.id === 'create') {
				const { nextAction, setLoadingInvite, navigator } = this.props;
				if (nextAction === 'CREATE_CHANNEL') {
					if (CreateChannelView == null) {
						CreateChannelView = require('./CreateChannelView').default;
						Navigation.registerComponent('CreateChannelView', () => CreateChannelView, store, Provider);
					}

					navigator.push({
						screen: 'CreateChannelView',
						title: I18n.t('Create_Channel'),
						backButtonTitle: ''
					});
				} else {
					const { rid } = this.props;
					try {
						setLoadingInvite(true);
						await RocketChat.addUsersToRoom(rid);
						navigator.pop();
					} catch (e) {
						log('RoomActions Add User', e);
					} finally {
						setLoadingInvite(false);
					}
				}
			}
		}
	}

	onSearchChangeText(text) {
		this.search(text);
	}

	// eslint-disable-next-line react/sort-comp
	updateState = debounce(() => {
		this.forceUpdate();
	}, 1000);

	search = async(text) => {
		const result = await RocketChat.search({ text, filterRooms: false });
		this.setState({
			search: result
		});
	}

	isChecked = (username) => {
		const { users } = this.props;
		return users.findIndex(el => el.name === username) !== -1;
	}

	toggleUser = (user) => {
		const { addUser, removeUser } = this.props;

		LayoutAnimation.easeInEaseOut();
		if (!this.isChecked(user.name)) {
			addUser(user);
		} else {
			removeUser(user);
		}
	}

	_onPressItem = (id, item = {}) => {
		if (item.search) {
			this.toggleUser({ _id: item._id, name: item.username, fname: item.name });
		} else {
			this.toggleUser({ _id: item._id, name: item.name, fname: item.fname });
		}
	}

	_onPressSelectedItem = item => this.toggleUser(item);

	renderHeader = () => (
		<View style={styles.header}>
			<SearchBox onChangeText={text => this.onSearchChangeText(text)} testID='select-users-view-search' />
			{this.renderSelected()}
		</View>
	)

	renderSelected = () => {
		const { users } = this.props;

		if (users.length === 0) {
			return null;
		}
		return (
			<FlatList
				data={users}
				keyExtractor={item => item._id}
				style={[styles.list, sharedStyles.separatorTop]}
				contentContainerStyle={{ marginVertical: 5 }}
				renderItem={this.renderSelectedItem}
				enableEmptySections
				keyboardShouldPersistTaps='always'
				horizontal
			/>
		);
	}

	renderSelectedItem = ({ item }) => {
		const { baseUrl } = this.props;
		return (
			<UserItem
				name={item.fname}
				username={item.name}
				onPress={() => this._onPressSelectedItem(item)}
				testID={`selected-user-${ item.name }`}
				baseUrl={baseUrl}
				style={{ paddingRight: 15 }}
			/>
		);
	}

	renderSeparator = () => <View style={[sharedStyles.separator, styles.separator]} />

	renderItem = ({ item, index }) => {
		const { search } = this.state;
		const { baseUrl } = this.props;

		const name = item.search ? item.name : item.fname;
		const username = item.search ? item.username : item.name;
		let style = {};
		if (index === 0) {
			style = { ...sharedStyles.separatorTop };
		}
		if (search.length > 0 && index === search.length - 1) {
			style = { ...style, ...sharedStyles.separatorBottom };
		}
		if (search.length === 0 && index === this.data.length - 1) {
			style = { ...style, ...sharedStyles.separatorBottom };
		}
		return (
			<UserItem
				name={name}
				username={username}
				onPress={() => this._onPressItem(item._id, item)}
				testID={`select-users-view-item-${ item.name }`}
				icon={this.isChecked(username) ? 'check' : null}
				baseUrl={baseUrl}
				style={style}
			/>
		);
	}

	renderList = () => {
		const { search } = this.state;
		return (
			<FlatList
				data={search.length > 0 ? search : this.data}
				extraData={this.props}
				keyExtractor={item => item._id}
				renderItem={this.renderItem}
				ItemSeparatorComponent={this.renderSeparator}
				ListHeaderComponent={this.renderHeader}
				enableEmptySections
				keyboardShouldPersistTaps='always'
			/>
		);
	}

	render = () => {
		const { loading } = this.props;
		return (
			<SafeAreaView style={styles.safeAreaView} testID='select-users-view'>
				{this.renderList()}
				<Loading visible={loading} />
			</SafeAreaView>
		);
	}
}
