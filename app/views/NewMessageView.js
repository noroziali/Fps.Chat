import React from 'react';
import PropTypes from 'prop-types';
import {
	View, StyleSheet, SafeAreaView, FlatList, Text, Platform, Image
} from 'react-native';
import { connect, Provider } from 'react-redux';
import { Navigation } from 'react-native-navigation';

import database from '../lib/realm';
import RocketChat from '../lib/rocketchat';
import UserItem from '../presentation/UserItem';
import debounce from '../utils/debounce';
import LoggedView from './View';
import sharedStyles from './Styles';
import I18n from '../i18n';
import Touch from '../utils/touch';
import SearchBox from '../containers/SearchBox';
import store from '../lib/createStore';

const styles = StyleSheet.create({
	safeAreaView: {
		flex: 1,
		backgroundColor: Platform.OS === 'ios' ? '#F7F8FA' : '#E1E5E8'
	},
	separator: {
		marginLeft: 60
	},
	createChannelButton: {
		marginVertical: 25
	},
	createChannelContainer: {
		height: 47,
		backgroundColor: '#fff',
		flexDirection: 'row',
		alignItems: 'center'
	},
	createChannelIcon: {
		width: 24,
		height: 24,
		marginHorizontal: 18
	},
	createChannelText: {
		color: '#1D74F5',
		fontSize: 18
	}
});

let SelectedUsersView = null;

@connect(state => ({
	baseUrl: state.settings.Site_Url || state.server ? state.server.server : ''
}))
/** @extends React.Component */
export default class NewMessageView extends LoggedView {
	static navigatorButtons = {
		leftButtons: [{
			id: 'cancel',
			title: I18n.t('Cancel')
		}]
	}

	static propTypes = {
		navigator: PropTypes.object,
		baseUrl: PropTypes.string,
		onPressItem: PropTypes.func.isRequired
	};

	constructor(props) {
		super('NewMessageView', props);
		this.data = database.objects('subscriptions').filtered('t = $0', 'd').sorted('roomUpdatedAt', true);
		this.state = {
			search: []
		};
		this.data.addListener(this.updateState);
		props.navigator.setOnNavigatorEvent(this.onNavigatorEvent.bind(this));
	}

	componentWillUnmount() {
		this.updateState.stop();
		this.data.removeAllListeners();
	}

	async onNavigatorEvent(event) {
		const { navigator } = this.props;
		if (event.type === 'NavBarButtonPress') {
			if (event.id === 'cancel') {
				navigator.dismissModal();
			}
		}
	}

	onSearchChangeText(text) {
		this.search(text);
	}

	onPressItem = (item) => {
		const { navigator, onPressItem } = this.props;
		navigator.dismissModal();
		setTimeout(() => {
			onPressItem(item);
		}, 600);
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

	createChannel = () => {
		if (SelectedUsersView == null) {
			SelectedUsersView = require('./SelectedUsersView').default;
			Navigation.registerComponent('SelectedUsersView', () => SelectedUsersView, store, Provider);
		}

		const { navigator } = this.props;
		navigator.push({
			screen: 'SelectedUsersView',
			title: I18n.t('Select_Users'),
			backButtonTitle: '',
			passProps: {
				nextAction: 'CREATE_CHANNEL'
			}
		});
	}

	renderHeader = () => (
		<View>
			<SearchBox onChangeText={text => this.onSearchChangeText(text)} testID='new-message-view-search' />
			<Touch onPress={this.createChannel} style={styles.createChannelButton} testID='new-message-view-create-channel'>
				<View style={[sharedStyles.separatorVertical, styles.createChannelContainer]}>
					<Image style={styles.createChannelIcon} source={{ uri: 'plus' }} />
					<Text style={styles.createChannelText}>{I18n.t('Create_Channel')}</Text>
				</View>
			</Touch>
		</View>
	)

	renderSeparator = () => <View style={[sharedStyles.separator, styles.separator]} />;

	renderItem = ({ item, index }) => {
		const { search } = this.state;
		const { baseUrl } = this.props;

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
				name={item.search ? item.name : item.fname}
				username={item.search ? item.username : item.name}
				onPress={() => this.onPressItem(item)}
				baseUrl={baseUrl}
				testID={`new-message-view-item-${ item.name }`}
				style={style}
			/>
		);
	}

	renderList = () => {
		const { search } = this.state;
		return (
			<FlatList
				data={search.length > 0 ? search : this.data}
				extraData={this.state}
				keyExtractor={item => item._id}
				ListHeaderComponent={this.renderHeader}
				renderItem={this.renderItem}
				ItemSeparatorComponent={this.renderSeparator}
				keyboardShouldPersistTaps='always'
			/>
		);
	}

	render = () => (
		<SafeAreaView style={styles.safeAreaView} testID='new-message-view'>
			{this.renderList()}
		</SafeAreaView>
	);
}
